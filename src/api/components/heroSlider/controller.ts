import { IHeroSlider } from 'interfaces/Itables';
import { EConcatWhere, EModeWhere, ESelectFunct } from '../../../enums/EfunctMysql';
import { Columns, Tables } from '../../../enums/EtablesDB';
import StoreType from '../../../store/mysql';
import OptimizeImg from '../../../utils/optimeImg';
import fs from 'fs';
import path from 'path';
import { staticFolders } from '../../../enums/EStaticFiles';
import { IWhereParams } from '../../../interfaces/Ifunctions';

export = (injectedStore: typeof StoreType) => {
    let store = injectedStore;

    const list = async (page: number) => {
        const data = await store.list(Tables.HERO_SLIDER, [ESelectFunct.all]);
        return {
            data
        };
    }

    const publicList = async () => {
        let filter: IWhereParams | undefined = undefined;
        let filters: Array<IWhereParams> = [];
        filter = {
            mode: EModeWhere.strict,
            concat: EConcatWhere.none,
            items: ([
                { column: Columns.heroSlider.active, object: String(1) }
            ])
        };
        filters.push(filter);
        const data = await store.list(Tables.HERO_SLIDER, [ESelectFunct.all], filters);
        return {
            data
        };
    }

    const upsert = async (body: IHeroSlider) => {
        const heroSlider: IHeroSlider = {
            id: body.id,
            title: body.title,
            subtitle: body.subtitle,
            image: body.filesName ? body.filesName[0]?.path : "",
            url: body.url,
            active: true,
            type: body.type
        }
        body.filesName && OptimizeImg(body.filesName[0]?.path, "heroSlider")

        if (body.id) {
            body.filesName && (body.image = body.filesName[0]?.path);
            delete body.filesName;
            return await store.update(Tables.HERO_SLIDER, body, body.id);
        } else {
            return await store.insert(Tables.HERO_SLIDER, heroSlider);
        }
    }

    const toggleEnabled = async (id: number, enabled: number) => {
        return await store.update(Tables.HERO_SLIDER, { active: enabled }, id);
    }

    const remove = async (idHero: number) => {
        try {
            const heroSlider = await store.get(Tables.HERO_SLIDER, idHero);
            fs.unlinkSync(path.join(staticFolders.heroSlider, heroSlider[0].image));
        } catch (error) {

        }
        return await store.remove(Tables.HERO_SLIDER, { id: idHero });
    }

    const get = async (idHero: number) => {
        return await store.get(Tables.HERO_SLIDER, idHero);
    }

    return {
        list,
        upsert,
        remove,
        get,
        toggleEnabled,
        publicList
    }
}

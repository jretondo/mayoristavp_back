import { MetodosPago } from './../enums/EtablesDB';
export interface Iauth {
  id?: number;
  usuario: string;
  pass?: string;
  prov: number;
}
export interface IUser {
  id?: number;
  nombre: string;
  apellido: string;
  email: string;
  usuario: string;
  pv: number;
  telefono: string;
}
export interface IUserPermission {
  id?: number;
  id_user: number;
  id_permission: number;
}
export interface IImgProd {
  id?: number;
  id_prod: number;
  url_img: string;
}
export interface IProveedor {
  id?: number;
  cuit: boolean;
  ndoc: string;
  razsoc: string;
  telefono: string;
  email: string;
  cond_iva: number;
  fantasia: string;
  obs: string;
  keyword: string;
}
export interface IClientes {
  id?: number;
  cuit: boolean;
  ndoc: string;
  razsoc: string;
  telefono: string;
  email: string;
  cond_iva: number;
  direccion: string;
  entrega: string;
  provincia: string;
  localidad: string;
}
export interface IMovStock {
  id?: number;
  fecha: Date;
  id_prod: number;
  pv_id: number;
  cant: number;
  venta: boolean;
  nro_remito: string;
  costo: number;
  iva: number;
  prod_name: string;
  pv_descr: string;
  category: string;
  sub_category: string;
  id_user?: number;
}

export interface IModPriceProd {
  id: number;
  precio_compra: number;
  porc_minor: number;
  round: number;
  vta_price: number;
  vta_fija: boolean;
}
export interface IFactura {
  id?: number;
  create_time?: Date;
  fecha: Date;
  pv: number;
  cbte: number;
  letra: string;
  cae?: string;
  vto_cae?: Date;
  t_fact: number;
  cuit_origen: number;
  iibb_origen: string;
  ini_act_origen: Date;
  direccion_origen: string;
  raz_soc_origen: string;
  cond_iva_origen: number;
  tipo_doc_cliente: number;
  n_doc_cliente: number;
  cond_iva_cliente: number;
  email_cliente: string;
  nota_cred: boolean;
  fiscal: boolean;
  raz_soc_cliente: string;
  user_id: number;
  seller_name: string;
  total_fact: number;
  total_iva: number;
  total_neto: number;
  total_compra: number;
  forma_pago: MetodosPago;
  pv_id: number;
  id_fact_asoc: number;
  descuento: number;
  det_rbo?: string;
  direccion_entrega: string;
  telefono: string;
  localidad: string;
  provincia: string;
  cat_pago: string;
  pagos?: IFormasPago[];
  items?: IDetFactura[];
}

export interface IDetFactura {
  id?: number;
  create_time?: Date;
  fact_id?: number;
  id_prod: number;
  nombre_prod: string;
  cant_prod: number;
  unidad_tipo_prod: number;
  total_prod: number;
  total_iva: number;
  total_costo: number;
  total_neto: number;
  alicuota_id: number;
  precio_ind: number;
  cant_anulada: number;
  descuento_porcentaje: number;
}

export interface IMovCtaCte {
  id?: number;
  fecha?: Date;
  id_cliente: number;
  id_factura: number;
  id_recibo: number;
  forma_pago: number;
  importe: number;
  detalle: string;
  razsoc?: string;
  ndoc?: string;
  letra?: string;
  pv?: number;
  cbte?: number;
  t_fact?: number;
  cuit?: boolean;
}

export interface IFormasPago {
  id?: number;
  id_fact: number;
  tipo: MetodosPago;
  importe: number;
  tipo_txt: string;
  fecha_emision: Date;
  fecha_vencimiento: Date;
  banco: string;
  nro_cheque: string;
  notas: string;
  id_cheque?: number;
}

export interface ICodigoAprobacion {
  id?: number;
  codigo: number;
  fecha: Date;
  vencimiento: Date;
}

export interface IHeroSlider {
  id?: number;
  title: string;
  subtitle: string;
  image: string;
  url: string;
  active: boolean;
  type: boolean;
  filesName?: Express.Multer.File[];
}

export interface IPedido {
  id?: number;
  fecha: Date;
  nombre: string;
  apellido: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  email: string;
  notas: string;
  items?: IPedidoItem[];
}

export interface IPedidoItem {
  id?: number;
  id_pedido: number;
  id_prod: number;
  cant_prod: number;
}

export interface ICategoriaPago {
  id?: string;
  categoria: string;
}

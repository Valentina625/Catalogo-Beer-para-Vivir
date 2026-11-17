function jsonRespuesta_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

// API consumida por el proxy de Vercel.
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '');
  try {
    if (action === 'productos') return jsonRespuesta_(obtenerProductos());
    if (action === 'proveedores') return jsonRespuesta_(obtenerProveedores());
    if (action === 'validarCupon') return jsonRespuesta_(validarCupon((e.parameter && e.parameter.codigo) || ''));
    return jsonRespuesta_({ error: 'Acción GET no válida.' });
  } catch (error) { return jsonRespuesta_({ error: error.message || String(error) }); }
}

function doPost(e) {
  try {
    const datos = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (datos.action === 'guardarPedido') return jsonRespuesta_(guardarPedido(datos));
    return jsonRespuesta_({ error: 'Acción POST no válida.' });
  } catch (error) { return jsonRespuesta_({ error: error.message || String(error) }); }
}

function precioSeguro_(valor) {
  if (typeof valor === 'number') return valor;
  return Number(
    String(valor || '')
      .replace(/\$/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
  );
}

function obtenerProductos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Productos');
  if (!hoja) return [];

  const filas = hoja.getDataRange().getValues();
  const productos = [];

  for (let i = 1; i < filas.length; i++) {
    const r = filas[i];
    if (!r[1] || !r[2]) continue;

    // Columna K: Visibilidad. Vacío o "Mostrar" = visible.
    const visibilidad = String(r[10] || 'Mostrar').trim().toUpperCase();
    if (visibilidad === 'NO MOSTRAR') continue;

    productos.push({
      imagen: typeof r[0] === 'string' ? r[0].trim() : '',
      id: String(r[1]).trim(),
      nombre: String(r[2]),
      categoria: r[3] || 'General',
      estilo: r[4] || '',
      marca: r[5] || '',
      descripcion: r[6] || '',
      precio: precioSeguro_(r[7]),
      stock: Number(r[8]) || 0,
      activo: r[9] || 'Stock'
    });
  }

  return productos;
}


// Hoja Proveedores:
// A Proveedor | B Logo URL | C Orden | D Activo
function obtenerProveedores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Proveedores');
  if (!hoja || hoja.getLastRow() < 2) return [];

  const filas = hoja.getDataRange().getValues();
  return filas.slice(1)
    .filter(r => String(r[0] || '').trim())
    .filter(r => String(r[3] || 'SI').trim().toUpperCase() === 'SI')
    .map(r => ({
      nombre: String(r[0]).trim(),
      logo: String(r[1] || '').trim(),
      orden: Number(r[2]) || 999
    }))
    .sort((a, b) => a.orden - b.orden);
}

// Ejecutar una sola vez desde Apps Script para crear la pestaña.
function configurarHojaProveedores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName('Proveedores');
  if (!hoja) hoja = ss.insertSheet('Proveedores');

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, 4).setValues([[
      'Proveedor', 'Logo URL', 'Orden', 'Activo'
    ]]);
    hoja.getRange(2, 1, 7, 4).setValues([
      ['Buko', '', 1, 'SI'],
      ['Bierlife', '', 2, 'SI'],
      ['Cuore', '', 3, 'SI'],
      ['12 Brujas', '', 4, 'SI'],
      ['Prinston', '', 5, 'SI'],
      ['Kirken', '', 6, 'SI'],
      ['Bizantina', '', 7, 'SI']
    ]);
    hoja.setFrozenRows(1);
    hoja.autoResizeColumns(1, 4);
  }
}

// Hoja Cupones:
// A Codigo | B Descuento | C Activo
// D UsoMaximo | E Usos

function buscarCupon_(codigo, ss) {
  codigo = String(codigo || '').trim().toUpperCase();

  if (!codigo) {
    return {
      valido: true,
      codigo: '',
      porcentaje: 0,
      fila: 0
    };
  }

  const hoja = ss.getSheetByName('Cupones');
  if (!hoja) throw new Error('Falta la pestaña Cupones.');

  const filas = hoja.getDataRange().getValues();

  for (let i = 1; i < filas.length; i++) {
    const f = filas[i];

    if (String(f[0] || '').trim().toUpperCase() !== codigo) {
      continue;
    }

    const porcentaje = Number(f[1]);
    const activo = String(f[2] || '').trim().toUpperCase() === 'SI';
    const maximo = Number(f[3]);
    const usos = Number(f[4]) || 0;

    if (!activo) {
      throw new Error('El cupón está inactivo.');
    }

    if (!Number.isFinite(porcentaje) ||
        porcentaje <= 0 || porcentaje > 100) {
      throw new Error('Descuento inválido.');
    }

    if (!Number.isInteger(maximo) || maximo < 1) {
      throw new Error('UsoMaximo debe ser mayor que cero.');
    }

    if (!Number.isSafeInteger(usos) || usos < 0) {
      throw new Error('El contador de usos no es válido.');
    }

    if (usos >= maximo) {
      throw new Error('El cupón agotó sus usos.');
    }

    return {
      valido: true,
      codigo: codigo,
      porcentaje: porcentaje,
      fila: i + 1,
      usos: usos
    };
  }

  throw new Error('El cupón no existe.');
}

function validarCupon(codigo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const cupon = buscarCupon_(codigo, ss);

  return {
    valido: true,
    codigo: cupon.codigo,
    porcentaje: cupon.porcentaje
  };
}

function guardarPedido(pedidoData) {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(20000)) {
    throw new Error(
      'Hay muchos pedidos simultáneos. Intentá nuevamente.'
    );
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hojaProductos = ss.getSheetByName('Productos');

    if (!hojaProductos) {
      throw new Error('No existe la pestaña Productos.');
    }

    const filas = hojaProductos.getDataRange().getValues();
    const catalogo = new Map();

    for (let i = 1; i < filas.length; i++) {
      const r = filas[i];
      const id = String(r[1] || '').trim();
      if (!id) continue;

      catalogo.set(id, {
        id: id,
        nombre: String(r[2] || ''),
        estilo: String(r[4] || ''),
        marca: String(r[5] || ''),
        precio: precioSeguro_(r[7]),
        stock: Number(r[8]) || 0,
        activo: String(r[9] || ''),
        visible: String(r[10] || 'Mostrar').trim().toUpperCase() !== 'NO MOSTRAR'
      });
    }

    const recibidos = pedidoData && pedidoData.items;

    if (!Array.isArray(recibidos) || !recibidos.length) {
      throw new Error('El pedido está vacío.');
    }

    const acumulados = new Map();

    recibidos.forEach(item => {
      const id = String(item.id || '').trim();
      const cantidad = Number(item.cantidad);

      if (!catalogo.has(id) ||
          !Number.isSafeInteger(cantidad) ||
          cantidad < 1) {
        throw new Error('Producto o cantidad inválidos.');
      }

      if (!catalogo.get(id).visible) {
        throw new Error('Este producto ya no está disponible en el catálogo.');
      }

      acumulados.set(
        id,
        (acumulados.get(id) || 0) + cantidad
      );
    });

    const items = [];
    let subtotal = 0;

    for (const [id, cantidad] of acumulados) {
      const p = catalogo.get(id);

      if (!Number.isFinite(p.precio) || p.precio <= 0) {
        throw new Error('Precio inválido para ' + p.nombre);
      }

      if (cantidad > p.stock) {
        throw new Error('Stock insuficiente para ' + p.nombre);
      }

      const item = {
        id: p.id,
        nombre: p.nombre,
        estilo: p.estilo,
        marca: p.marca,
        cantidad: cantidad,
        precioUnitario: p.precio,
        subtotal: p.precio * cantidad
      };

      subtotal += item.subtotal;
      items.push(item);
    }

    const nombre = String(
      (pedidoData.cliente && pedidoData.cliente.nombre) || ''
    ).trim();

    const telefono = String(
      (pedidoData.cliente && pedidoData.cliente.telefono) || ''
    ).trim();

    if (!nombre || !telefono) {
      throw new Error('Completá nombre y teléfono.');
    }

    const tipo = String(
      (pedidoData.entrega && pedidoData.entrega.tipo) || 'Bar'
    );

    if (!['Bar','Envio'].includes(tipo)) {
      throw new Error('Modalidad de entrega inválida.');
    }

    const cupon = buscarCupon_(pedidoData.cupon,ss);

    const descuentoMonto = Math.round(
      subtotal * cupon.porcentaje / 100
    );

    const total = subtotal - descuentoMonto;

    // Notas del cliente: máximo 500 caracteres.
    const notas = String(pedidoData.notas || '')
      .trim()
      .slice(0,500);

    // Evita interpretar las notas como fórmulas de Sheets.
    const notasSeguras = /^[=+@-]/.test(notas)
      ? "'" + notas
      : notas;

    let cabecera = ss.getSheetByName('Pedidos_Cabecera');

    if (!cabecera) {
      cabecera = ss.insertSheet('Pedidos_Cabecera');
      cabecera.appendRow([
        'ID Pedido',
        'Fecha',
        'Cliente',
        'Teléfono',
        'Tipo Entrega',
        'Detalles',
        'Cupón',
        'Descuento',
        'Total',
        'Estado',
        'Notas del cliente'
      ]);
    }

    let detalle = ss.getSheetByName('Pedido_detalle');

    if (!detalle) {
      detalle = ss.insertSheet('Pedido_detalle');
      detalle.appendRow([
        'ID Pedido',
        'ID Producto',
        'Nombre',
        'Estilo',
        'Marca',
        'Cantidad',
        'Precio Unitario',
        'Subtotal'
      ]);
    }

    // Agrega el encabezado de notas si ya existía la hoja.
    if (cabecera.getRange(1,11).getValue() !==
        'Notas del cliente') {
      cabecera.getRange(1,11)
        .setValue('Notas del cliente');
    }

    const idPedido = 'PED-' +
      Utilities.formatDate(
        new Date(),
        'GMT-3',
        'yyyyMMdd-HHmmss'
      ) + '-' + Utilities.getUuid().slice(0,6);

    const fecha = new Date();

    cabecera.appendRow([
      idPedido,
      fecha,
      nombre,
      telefono,
      tipo,
      tipo === 'Bar'
        ? 'Retiro en Bar'
        : 'Envío a domicilio',
      cupon.codigo || 'Ninguno',
      cupon.porcentaje + '%',
      total,
      'Pendiente',
      notasSeguras
    ]);

    const detalles = items.map(item => [
      idPedido,
      item.id,
      item.nombre,
      item.estilo,
      item.marca,
      item.cantidad,
      item.precioUnitario,
      item.subtotal
    ]);

    detalle.getRange(
      detalle.getLastRow() + 1,
      1,
      detalles.length,
      8
    ).setValues(detalles);

    if (cupon.fila) {
      ss.getSheetByName('Cupones')
        .getRange(cupon.fila,5)
        .setValue(cupon.usos + 1);
    }

    return {
      status: 'success',
      idPedido: idPedido,
      subtotal: subtotal,
      descuentoMonto: descuentoMonto,
      porcentaje: cupon.porcentaje,
      total: total,
      cupon: cupon.codigo || 'Ninguno',
      items: items
    };

  } finally {
    lock.releaseLock();
  }
}


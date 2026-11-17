async function llamarAPI(action, datos = null, parametros = {}) {
  const url = new URL('/api/backend', window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(parametros).forEach(([k, v]) => url.searchParams.set(k, v));
  const opciones = datos === null ? { method: 'GET', headers: { 'Accept': 'application/json' } } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...datos }) };
  const respuesta = await fetch(url.toString(), opciones);
  const resultado = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || resultado.error) throw new Error(resultado.error || 'No se pudo completar la solicitud.');
  return resultado;
}

let productosGlobal = [];
let carrito = {};
let categoriaActiva = 'TODAS';
let descuentoAplicado = 0;
let cuponValidado = '';

function formatoPrecio(n) {
  return '$' + Number(n || 0).toLocaleString('es-AR');
}

function escaparHTML(v) {
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

window.onload = async function() {
  const grid = document.getElementById('productosGrid');
  try {
    const data = await llamarAPI('productos');
    productosGlobal = Array.isArray(data) ? data : [];
    construirCategorias();
    renderizarProductos(productosGlobal);
  } catch (e) {
    grid.innerHTML = '<p style="grid-column:1/-1;color:#a00;padding:30px">Error al cargar productos: ' + escaparHTML(e.message) + '</p>';
  }
  try {
    const proveedores = await llamarAPI('proveedores');
    renderizarProveedores(proveedores);
  } catch (err) { console.warn('No se pudieron cargar los proveedores:', err); }
};

function renderizarProveedores(proveedores) {
  const section = document.getElementById('proveedoresSection');
  const grid = document.getElementById('providersGrid');

  if (!Array.isArray(proveedores) || !proveedores.length) return;

  const conLogo = proveedores.filter(p => p.logo);
  if (!conLogo.length) return;

  grid.innerHTML = '';

  conLogo.forEach(p => {
    const item = document.createElement('div');
    const logoBox = document.createElement('div');
    logoBox.className = 'provider-logo';

    const img = document.createElement('img');
    img.src = limpiarUrlImagen(p.logo);
    img.alt = p.nombre;
    img.loading = 'lazy';

    img.onerror = function() {
      item.remove();
      if (!grid.children.length) section.style.display = 'none';
    };

    logoBox.appendChild(img);

    const nombre = document.createElement('div');
    nombre.className = 'provider-name';
    nombre.textContent = p.nombre;

    item.append(logoBox, nombre);
    grid.appendChild(item);
  });

  section.style.display = 'block';
}

function construirCategorias() {
  const container = document.getElementById('categoriasContainer');
  container.innerHTML = '';

  const categorias = [
    'TODAS',
    ...new Set(productosGlobal.map(p =>
      String(p.categoria || '').trim()
    ).filter(Boolean))
  ];

  categorias.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-pill' +
      (cat === categoriaActiva ? ' active' : '');
    btn.textContent = cat === 'TODAS' ? 'Todas' : cat;

    btn.onclick = () => {
      categoriaActiva = cat;
      construirCategorias();
      filtrarProductos();
    };

    container.appendChild(btn);
  });
}

function filtrarProductos() {
  const texto = document.getElementById('searchInput')
    .value.toLowerCase().trim();

  const filtrados = productosGlobal.filter(p => {
    const cat = String(p.categoria || '').trim();

    const coincideCategoria =
      categoriaActiva === 'TODAS' ||
      cat.toUpperCase() === categoriaActiva.toUpperCase();

    const busqueda = [
      p.nombre,p.estilo,p.marca
    ].join(' ').toLowerCase();

    return coincideCategoria && busqueda.includes(texto);
  });

  renderizarProductos(filtrados);
}

function limpiarUrlImagen(url) {
  if (!url || typeof url !== 'string') return '';

  const limpia = url.trim();

  if (limpia.includes('drive.google.com/file/d/')) {
    const match = limpia.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      return 'https://lh3.googleusercontent.com/d/' + match[1];
    }
  }

  return limpia;
}

function renderizarProductos(productos) {
  const grid = document.getElementById('productosGrid');
  grid.innerHTML = '';

  if (!productos.length) {
    grid.innerHTML =
      '<p style="grid-column:1/-1;color:#555;text-align:center;padding:30px">' +
      'No se encontraron productos.</p>';
    return;
  }

  productos.forEach(p => {
    const stock = Number(p.stock) || 0;
    const disponible = stock > 0;
    const precio = Number(p.precio) || 0;

    const imagen = limpiarUrlImagen(p.imagen) ||
      'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300';

    const card = document.createElement('div');
    card.className = 'product-card';

    const cajaImagen = document.createElement('div');
    cajaImagen.className = 'product-img-box';

    const img = document.createElement('img');
    img.src = imagen;
    img.alt = String(p.nombre || 'Cerveza');

    img.onerror = function() {
      this.onerror = null;
      this.src = 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=300';
    };

    const badge = document.createElement('span');
    badge.className = 'badge-stock ' + (disponible ? 'in' : 'out');
    badge.textContent = disponible ? 'Stock' : 'Sin stock';

    cajaImagen.append(img,badge);

    const info = document.createElement('div');
    info.className = 'product-info';

    const marca = document.createElement('span');
    marca.className = 'product-brand';
    marca.textContent = p.marca || '';

    const nombre = document.createElement('h3');
    nombre.className = 'product-title';
    nombre.textContent = p.nombre || '';

    const estilo = document.createElement('p');
    estilo.className = 'product-style';
    estilo.textContent = p.estilo || '';

    info.append(marca,nombre,estilo);

    const footer = document.createElement('div');
    footer.className = 'product-footer';

    const precioEl = document.createElement('span');
    precioEl.className = 'product-price';
    precioEl.textContent = formatoPrecio(precio);

    const btn = document.createElement('button');
    btn.className = 'btn-add';
    btn.innerHTML = '<i class="fas fa-plus"></i>';
    btn.disabled = !disponible;
    btn.onclick = () => cambiarCantidad(p.id,1);

    footer.append(precioEl,btn);
    card.append(cajaImagen,info,footer);
    grid.appendChild(card);
  });
}

function cambiarCantidad(id,delta) {
  const producto = productosGlobal.find(p =>
    String(p.id) === String(id)
  );

  if (!producto) return;

  const clave = String(producto.id);
  const actual = carrito[clave] ? carrito[clave].cantidad : 0;
  const nueva = actual + delta;

  if (nueva > Number(producto.stock || 0)) {
    alert('No hay más stock disponible.');
    return;
  }

  if (nueva <= 0) {
    delete carrito[clave];
  } else {
    carrito[clave] = {
      id:producto.id,
      nombre:producto.nombre,
      estilo:producto.estilo,
      marca:producto.marca,
      precioUnitario:Number(producto.precio) || 0,
      cantidad:nueva
    };
  }

  actualizarBarraCarrito();
}

function actualizarBarraCarrito() {
  const items = Object.values(carrito);
  const cantidad = items.reduce((s,i) => s+i.cantidad,0);

  const subtotal = items.reduce(
    (s,i) => s+i.precioUnitario*i.cantidad,0
  );

  const total = Math.round(subtotal*(1-descuentoAplicado));

  document.getElementById('headerCartCount').textContent = cantidad;
  document.getElementById('headerCartTotal').textContent = formatoPrecio(total);

  document.getElementById('cartCount').textContent =
    cantidad + (cantidad === 1 ? ' ítem' : ' ítems');

  document.getElementById('cartTotal').textContent = formatoPrecio(total);

  document.getElementById('cartBar').style.display =
    cantidad > 0 ? 'flex' : 'none';

  if (cantidad === 0) cerrarCarrito();
}

function abrirCarrito() {
  renderizarItemsCarrito();
  document.getElementById('cartModal').style.display = 'flex';
}

function cerrarCarrito() {
  document.getElementById('cartModal').style.display = 'none';
}

function renderizarItemsCarrito() {
  const cont = document.getElementById('cartItemsList');
  cont.innerHTML = '';

  const items = Object.values(carrito);

  if (!items.length) {
    cont.innerHTML =
      '<p style="color:#aaa;padding:20px">Tu carrito está vacío.</p>';
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';

    const desc = document.createElement('div');

    const titulo = document.createElement('h4');
    titulo.style.fontSize = '.85rem';
    titulo.textContent = item.nombre;

    const precio = document.createElement('p');
    precio.style.color = 'var(--gold)';
    precio.textContent = formatoPrecio(
      item.precioUnitario*item.cantidad
    );

    desc.append(titulo,precio);

    const controles = document.createElement('div');
    controles.className = 'qty-controls';

    const menos = document.createElement('button');
    menos.textContent = '−';

    menos.onclick = () => {
      cambiarCantidad(item.id,-1);
      renderizarItemsCarrito();
    };

    const numero = document.createElement('span');
    numero.textContent = item.cantidad;

    const mas = document.createElement('button');
    mas.textContent = '+';

    mas.onclick = () => {
      cambiarCantidad(item.id,1);
      renderizarItemsCarrito();
    };

    controles.append(menos,numero,mas);
    row.append(desc,controles);
    cont.appendChild(row);
  });
}

function aplicarCupon() {
  const input = document.getElementById('cuponInput');
  const codigo = input.value.trim().toUpperCase();
  const msg = document.getElementById('cuponMsg');

  descuentoAplicado = 0;
  cuponValidado = '';
  actualizarBarraCarrito();

  if (!codigo) {
    msg.textContent = 'Ingresá un código.';
    return;
  }

  msg.style.color = '#aaa';
  msg.textContent = 'Validando cupón...';

  llamarAPI('validarCupon', null, { codigo })
    .then(function(res) {
      if (input.value.trim().toUpperCase() !== codigo) return;
      descuentoAplicado = Number(res.porcentaje) / 100;
      cuponValidado = codigo;
      msg.style.color = 'var(--green)';
      msg.textContent = '¡Cupón aplicado! ' + res.porcentaje + '% de descuento.';
      actualizarBarraCarrito();
    })
    .catch(function(e) {
      if (input.value.trim().toUpperCase() !== codigo) return;
      descuentoAplicado = 0;
      cuponValidado = '';
      msg.style.color = '#ff4d4d';
      msg.textContent = e.message || 'Cupón inválido.';
      actualizarBarraCarrito();
    });
}

document.getElementById('cuponInput')
  .addEventListener('input',function() {
    descuentoAplicado = 0;
    cuponValidado = '';
    document.getElementById('cuponMsg').textContent = '';
    actualizarBarraCarrito();
  });

function enviarPedido() {
  const nombre = document.getElementById('clienteNombre').value.trim();
  const telefono = document.getElementById('clienteTelefono').value.trim();
  const tipoEntrega = document.getElementById('tipoEntrega').value;
  const notasPedido = document.getElementById('notasPedido').value.trim();

  if (!nombre || !telefono) {
    alert('Completá nombre y teléfono.');
    return;
  }

  const items = Object.values(carrito);

  if (!items.length) {
    alert('Agregá una cerveza al carrito.');
    return;
  }

  const codigoEscrito = document.getElementById('cuponInput')
    .value.trim().toUpperCase();

  if (codigoEscrito && codigoEscrito !== cuponValidado) {
    alert('Primero validá el cupón con Canjear.');
    return;
  }

  const pedidoData = {
    cliente:{nombre,telefono},
    entrega:{tipo:tipoEntrega},
    cupon:cuponValidado,
    notas:notasPedido,
    items:items.map(i => ({id:i.id,cantidad:i.cantidad}))
  };

  document.getElementById('loadingOverlay').style.display = 'flex';

  llamarAPI('guardarPedido', pedidoData)
    .then(function(res) {
      document.getElementById('loadingOverlay').style.display = 'none';

      const lineas = [
        '🍺 *NUEVO PEDIDO - BEER PARA VIVIR*',
        'Pedido: ' + res.idPedido,
        'Cliente: ' + nombre,
        'Teléfono: ' + telefono,
        'Notas: ' + (notasPedido || 'Sin observaciones'),
        'Entrega: ' + (
          tipoEntrega === 'Bar' ? 'Retiro en Bar' : 'Envío a domicilio'
        ),
        'Cupón: ' + res.cupon + ' (' + res.porcentaje + '%)',
        'Total: ' + formatoPrecio(res.total),
        '',
        'Detalle del pedido:',
        ...res.items.map(i =>
          '• ' + i.cantidad + 'x ' + i.nombre +
          ' (' + formatoPrecio(i.subtotal) + ')'
        )
      ];

      const url = 'https://wa.me/5491136091840?text=' +
        encodeURIComponent(lineas.join('\n'));

      carrito = {};
      descuentoAplicado = 0;
      cuponValidado = '';

      document.getElementById('cuponInput').value = '';
      document.getElementById('notasPedido').value = '';
      document.getElementById('cuponMsg').textContent = '';

      actualizarBarraCarrito();
      cerrarCarrito();

      window.open(url,'_blank');
      alert('Pedido registrado: ' + res.idPedido);
    })
    .catch(function(e) {
      document.getElementById('loadingOverlay').style.display = 'none';
      alert('No se pudo registrar el pedido: ' +
        (e.message || 'Error desconocido'));
    });
}

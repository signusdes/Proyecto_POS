// --- BLOQUE 1: Estado global de la aplicación ---
let usuarioActual = null;
let ticketVentaActual = [];
let renglonTicketSeleccionado = null;
let procesandoAgregar = false;

let componentesPackActuales = [];
let productosDisponiblesPack = [];
let inventarioGlobalCache = [];
let productoInventarioSeleccionado = null;


// --- BLOQUE 2: Notificaciones ---
function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${tipo}`;

    const icono = tipo === 'success' ? '✔' : tipo === 'error' ? '✖' : 'ℹ️';
    const iconoEl = document.createElement('span');
    const mensajeEl = document.createElement('span');

    iconoEl.textContent = icono;
    iconoEl.style.fontWeight = 'bold';
    iconoEl.style.fontSize = '16px';
    mensajeEl.textContent = mensaje;

    toast.append(iconoEl, mensajeEl);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}


// --- BLOQUE 3: Inicio, reloj, escáner, tema y eventos globales ---
window.addEventListener('DOMContentLoaded', () => {
    actualizarReloj();
    setInterval(actualizarReloj, 1000);

    cargarUsuariosLogin();
    cargarDepartamentosSelect();

    // La primera vista es Control Salidas. Productos empieza oculto.
    const submenuSalidas = document.getElementById('submenu-salidas');
    const submenuProductos = document.getElementById('submenu-productos');
    if (submenuSalidas) submenuSalidas.style.display = 'flex';
    if (submenuProductos) submenuProductos.style.display = 'none';

    const inputCodigo = document.getElementById('input-codigo-venta');

    if (inputCodigo) {
        inputCodigo.addEventListener('keypress', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const sugerencias = document.getElementById('sugerencias-salida-live');
                if (sugerencias) sugerencias.style.display = 'none';
                agregarAlTicketSimulado();
            }
        });
    }

    // Captura de códigos enviados rápidamente por un escáner USB/Bluetooth.
    let bufferCodigoBarras = '';
    let ultimoTiempoEscaneo = Date.now();

    window.addEventListener('keypress', event => {
        const tiempoActual = Date.now();
        const activo = document.activeElement;
        const activoTag = activo ? activo.tagName : '';

        if (
            activoTag === 'TEXTAREA' ||
            (activoTag === 'INPUT' && activo.id !== 'input-codigo-venta') ||
            activoTag === 'SELECT'
        ) {
            return;
        }

        if (tiempoActual - ultimoTiempoEscaneo > 100) {
            bufferCodigoBarras = '';
        }

        ultimoTiempoEscaneo = tiempoActual;

        if (event.key === 'Enter') {
            if (bufferCodigoBarras.trim().length > 1 && inputCodigo) {
                event.preventDefault();
                inputCodigo.value = bufferCodigoBarras.trim();

                const sugerencias = document.getElementById('sugerencias-salida-live');
                if (sugerencias) sugerencias.style.display = 'none';

                agregarAlTicketSimulado();
            }
            bufferCodigoBarras = '';
        } else if (event.key.length === 1) {
            bufferCodigoBarras += event.key;
        }
    });

    // Suprimir elimina el renglón seleccionado si el foco no está en un campo.
    window.addEventListener('keydown', event => {
        if (event.key !== 'Delete' && event.key !== 'Supr') return;

        const activo = document.activeElement;
        if (
            activo &&
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName)
        ) {
            return;
        }

        if (
            renglonTicketSeleccionado !== null &&
            renglonTicketSeleccionado >= 0 &&
            renglonTicketSeleccionado < ticketVentaActual.length
        ) {
            const producto = ticketVentaActual[renglonTicketSeleccionado];
            eliminarRenglonTicket(renglonTicketSeleccionado);
            mostrarNotificacion(
                `"${producto.nombre}" eliminado con la tecla Suprimir.`,
                'info'
            );
        }
    });

    // Oculta las sugerencias de ventas al hacer clic fuera del buscador.
    document.addEventListener('click', event => {
        const sugerencias = document.getElementById('sugerencias-salida-live');
        const input = document.getElementById('input-codigo-venta');

        if (
            sugerencias &&
            input &&
            !sugerencias.contains(event.target) &&
            event.target !== input
        ) {
            sugerencias.style.display = 'none';
        }
    });

    const temaGuardado = localStorage.getItem('pos_theme');
    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
        const icono = document.getElementById('icono-modo-tema');
        if (icono) icono.textContent = '☀️';
    }

    renderizarTablaTicket();
});

function actualizarReloj() {
    const ahora = new Date();
    const fecha = document.getElementById('fecha-actual');
    const hora = document.getElementById('hora-actual');

    if (fecha) {
        fecha.textContent = ahora.toLocaleDateString('es-MX', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    if (hora) hora.textContent = ahora.toLocaleTimeString('es-MX');
}

function alternarModoOscuro() {
    document.body.classList.toggle('dark-mode');

    const oscuro = document.body.classList.contains('dark-mode');
    const icono = document.getElementById('icono-modo-tema');

    if (icono) icono.textContent = oscuro ? '☀️' : '🌙';
    localStorage.setItem('pos_theme', oscuro ? 'dark' : 'light');

    mostrarNotificacion(
        oscuro ? 'Modo oscuro activado.' : 'Modo claro activado.',
        'info'
    );
}


// --- BLOQUE 4: Login, usuarios y sesión ---
async function cargarUsuariosLogin() {
    try {
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();
        const select = document.getElementById('login-select-usuario');
        if (!select) return;

        select.innerHTML = '<option value="">-- Seleccione un usuario --</option>';

        usuarios.forEach(usuario => {
            const option = document.createElement('option');
            option.value = usuario.usuario;
            option.textContent = `${usuario.nombre_completo} (${usuario.usuario})`;
            select.appendChild(option);
        });

        const otro = document.createElement('option');
        otro.value = '__otro__';
        otro.textContent = '➕ Escribir otro usuario...';
        select.appendChild(otro);
    } catch (error) {
        console.error('Error al cargar usuarios para login:', error);
    }
}

function seleccionarUsuarioLogin(select) {
    const contenedor = document.getElementById('contenedor-input-usuario');
    const input = document.getElementById('login-usuario');

    if (select.value === '__otro__') {
        if (contenedor) contenedor.style.display = 'block';
        if (input) {
            input.value = '';
            input.focus();
        }
    } else {
        if (contenedor) contenedor.style.display = 'none';
        if (input) input.value = select.value;
    }
}

function toggleMenuUsuario(event) {
    event.stopPropagation();
    const menu = document.getElementById('user-menu');

    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function cerrarSesion() {
    usuarioActual = null;
    ticketVentaActual = [];
    renglonTicketSeleccionado = null;
    renderizarTablaTicket();

    const login = document.getElementById('vista-login');
    const sistema = document.getElementById('sistema-principal');

    if (login) {
        login.classList.remove('oculto');
        login.style.display = 'flex';
    }

    if (sistema) {
        sistema.classList.add('oculto');
        sistema.style.display = 'none';
    }

    const password = document.getElementById('login-password');
    if (password) password.value = '';

    cargarUsuariosLogin();
    mostrarNotificacion('Sesión cerrada correctamente.', 'info');
}

function cambiarUsuarioModal() {
    cerrarSesion();
}

async function autenticarUsuario(event) {
    event.preventDefault();

    const select = document.getElementById('login-select-usuario');
    const inputUsuario = document.getElementById('login-usuario');
    const inputPassword = document.getElementById('login-password');

    let usuario = select ? select.value : '';
    if (usuario === '__otro__' || !usuario) {
        usuario = inputUsuario ? inputUsuario.value.trim() : '';
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuario,
                password: inputPassword ? inputPassword.value : ''
            })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'Credenciales incorrectas.', 'error');
            return;
        }

        usuarioActual = data.usuario;

        const login = document.getElementById('vista-login');
        const sistema = document.getElementById('sistema-principal');

        if (login) {
            login.classList.add('oculto');
            login.style.display = 'none';
        }

        if (sistema) {
            sistema.classList.remove('oculto');
            sistema.style.display = 'block';
        }

        const nombre = document.getElementById('nombre-usuario');
        const avatar = document.getElementById('avatar-inicial');
        if (nombre) nombre.textContent = usuarioActual;
        if (avatar) avatar.textContent = usuarioActual.charAt(0).toUpperCase();

        const botonAdmin = document.getElementById('btn-tab-admin');
        if (botonAdmin) {
            const usuarioLower = usuario.toLowerCase();
            botonAdmin.style.display =
                usuarioLower === 'admin' || usuarioLower === 'administrador'
                    ? 'inline-flex'
                    : 'none';
        }

        cambiarVista(
            'ventas',
            document.querySelector('#barra-navegacion .nav-btn')
        );
        mostrarNotificacion(`Bienvenido, ${usuarioActual}`, 'success');
    } catch (error) {
        console.error('Error en login:', error);
        mostrarNotificacion('Error de conexión con el servidor.', 'error');
    }
}


// --- BLOQUE 5: Navegación y submenús contextuales ---
function cambiarVista(nombreVista, botonElemento) {
    document.querySelectorAll('.view-section').forEach(vista => {
        vista.classList.remove('active');
        vista.style.display = 'none';
    });

    document.querySelectorAll('#barra-navegacion .nav-btn').forEach(boton => {
        boton.classList.remove('active');
    });

    const vista = document.getElementById(`vista-${nombreVista}`);
    if (vista) {
        vista.classList.add('active');
        vista.style.display = 'block';
    }

    if (botonElemento) botonElemento.classList.add('active');

    const submenuSalidas = document.getElementById('submenu-salidas');
    const submenuProductos = document.getElementById('submenu-productos');

    if (submenuSalidas) {
        submenuSalidas.style.display = nombreVista === 'ventas' ? 'flex' : 'none';
    }
    if (submenuProductos) {
        submenuProductos.style.display =
            nombreVista === 'productos' ? 'flex' : 'none';
    }

    if (nombreVista === 'inventario') cargarInventarioCompleto();
    if (nombreVista === 'admin-usuarios') cargarTablaUsuariosAdmin();
}

function cambiarSubProducto(subseccion, boton) {
    document.querySelectorAll('#vista-productos .sub-section').forEach(seccion => {
        seccion.classList.remove('active');
        seccion.style.display = 'none';
    });

    document.querySelectorAll(
        '#submenu-productos [data-subproducto]'
    ).forEach(botonSubmenu => {
        botonSubmenu.classList.remove('active');
    });

    const seccion = document.getElementById(`sub-${subseccion}`);
    if (seccion) {
        seccion.classList.add('active');
        seccion.style.display = 'block';
    }

    if (boton) boton.classList.add('active');
}


// --- BLOQUE 6: Búsqueda y captura de productos para salidas ---
function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[caracter]);
}

function buscarProductosTiempoReal(valor) {
    const sugerencias = document.getElementById('sugerencias-salida-live');
    if (!sugerencias) return;

    const query = valor.trim();
    if (!query) {
        sugerencias.style.display = 'none';
        return;
    }

    fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(productos => {
            if (!productos.length) {
                sugerencias.innerHTML =
                    '<div class="suggestion-empty">No se encontraron coincidencias.</div>';
                sugerencias.style.display = 'block';
                return;
            }

            sugerencias.innerHTML = productos.map(producto => {
                const nombre = escaparHTML(producto.nombre);
                const codigo = escaparHTML(producto.codigo_barras);
                const imagen = producto.imagen
                    ? `<img src="${escaparHTML(producto.imagen)}" alt="" class="suggestion-image">`
                    : '<span class="suggestion-placeholder">📦</span>';
                const stock = Number(producto.stock) || 0;
                const precio = Number(producto.precio_venta) || 0;

                return `
                    <button
                        type="button"
                        class="product-suggestion"
                        data-codigo="${codigo}"
                        onclick="seleccionarProductoDeBuscador(this.dataset.codigo)"
                    >
                        ${imagen}
                        <span class="suggestion-description">
                            <strong>${nombre}</strong>
                            <small>SKU: ${codigo}</small>
                        </span>
                        <span class="suggestion-price">
                            <strong>$${precio.toFixed(2)}</strong>
                            <small>Stock: ${stock}</small>
                        </span>
                    </button>
                `;
            }).join('');

            sugerencias.style.display = 'block';
        })
        .catch(error => console.error('Error en búsqueda en vivo:', error));
}

function seleccionarProductoDeBuscador(codigo) {
    const input = document.getElementById('input-codigo-venta');
    const sugerencias = document.getElementById('sugerencias-salida-live');

    if (input) input.value = codigo;
    if (sugerencias) sugerencias.style.display = 'none';

    agregarAlTicketSimulado();
}

async function agregarAlTicketSimulado() {
    if (procesandoAgregar) return;

    const input = document.getElementById('input-codigo-venta');
    if (!input || !input.value.trim()) return;

    const codigo = input.value.trim();
    procesandoAgregar = true;

    try {
        const response = await fetch(
            `/api/productos/buscar?q=${encodeURIComponent(codigo)}`
        );
        const productos = await response.json();

        if (!productos.length) {
            mostrarNotificacion(`Producto "${codigo}" no encontrado.`, 'error');
            return;
        }

        const producto =
            productos.find(item => item.codigo_barras === codigo) || productos[0];

        if (Number(producto.stock) <= 0) {
            mostrarNotificacion(
                `El producto "${producto.nombre}" no tiene stock disponible.`,
                'error'
            );
            return;
        }

        const indice = ticketVentaActual.findIndex(item => item.id === producto.id);

        if (indice >= 0) {
            if (ticketVentaActual[indice].cantidad + 1 > Number(producto.stock)) {
                mostrarNotificacion(
                    `Límite de stock alcanzado para "${producto.nombre}".`,
                    'error'
                );
                return;
            }
            ticketVentaActual[indice].cantidad += 1;
        } else {
            ticketVentaActual.push({
                id: producto.id,
                codigo_barras: producto.codigo_barras,
                nombre: producto.nombre,
                precio_venta: Number(producto.precio_venta) || 0,
                stock: Number(producto.stock) || 0,
                imagen: producto.imagen || '',
                cantidad: 1
            });
        }

        input.value = '';

        const sugerencias = document.getElementById('sugerencias-salida-live');
        if (sugerencias) sugerencias.style.display = 'none';

        renderizarTablaTicket();
        mostrarNotificacion(
            `"${producto.nombre}" agregado a la salida.`,
            'success'
        );
    } catch (error) {
        console.error('Error al agregar producto:', error);
        mostrarNotificacion('Error de conexión al agregar producto.', 'error');
    } finally {
        procesandoAgregar = false;
    }
}


// --- BLOQUE 7: Ticket, cantidades, cancelación y registro de salida ---
function renderizarTablaTicket() {
    const tbody = document.getElementById('tabla-ticket-body');
    const totalTexto = document.getElementById('total-ticket-txt');
    const contador = document.getElementById('contador-articulos');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (ticketVentaActual.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-table-message">
                    La lista de salida está vacía. Escanee o agregue un artículo.
                </td>
            </tr>
        `;
        if (totalTexto) totalTexto.textContent = '$0.00';
        if (contador) contador.textContent = '0 Artículos en la salida actual.';
        renglonTicketSeleccionado = null;
        return;
    }

    let totalGeneral = 0;
    let cantidadArticulos = 0;

    ticketVentaActual.forEach((item, index) => {
        const precio = Number(item.precio_venta) || 0;
        const cantidad = Number(item.cantidad) || 0;
        const stock = Number(item.stock) || 0;
        const importe = precio * cantidad;

        totalGeneral += importe;
        cantidadArticulos += cantidad;

        const fila = document.createElement('tr');
        if (renglonTicketSeleccionado === index) {
            fila.classList.add('ticket-row-selected');
        }

        const imagen = item.imagen
            ? `<img src="${escaparHTML(item.imagen)}" alt="" class="ticket-thumbnail">`
            : '<span class="ticket-placeholder">📦</span>';

        fila.innerHTML = `
            <td>${imagen}</td>
            <td>${escaparHTML(item.codigo_barras)}</td>
            <td>${escaparHTML(item.nombre)}</td>
            <td>$${precio.toFixed(2)}</td>
            <td>
                <input
                    type="number"
                    min="1"
                    max="${stock}"
                    value="${cantidad}"
                    aria-label="Cantidad de ${escaparHTML(item.nombre)}"
                    onchange="modificarCantidadTicket(${index}, this.value)"
                >
                <small>Disponible después: ${Math.max(0, stock - cantidad)}</small>
            </td>
            <td>$${importe.toFixed(2)}</td>
            <td>
                <button
                    type="button"
                    class="danger-btn"
                    onclick="eliminarRenglonTicket(${index})"
                    title="Eliminar fila"
                >🗑️</button>
            </td>
        `;

        fila.addEventListener('click', () => seleccionarFilaTicket(index));
        fila.querySelector('input').addEventListener('click', event => event.stopPropagation());
        fila.querySelector('button').addEventListener('click', event => event.stopPropagation());
        tbody.appendChild(fila);
    });

    if (totalTexto) totalTexto.textContent = `$${totalGeneral.toFixed(2)}`;
    if (contador) {
        contador.textContent =
            `${cantidadArticulos} Artículo(s) en la salida actual.`;
    }
}

function seleccionarFilaTicket(indice) {
    renglonTicketSeleccionado = indice;
    renderizarTablaTicket();
}

function modificarCantidadTicket(indice, valor) {
    const cantidad = Number.parseInt(valor, 10);
    const item = ticketVentaActual[indice];
    if (!item) return;

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        eliminarRenglonTicket(indice);
        return;
    }

    if (cantidad > item.stock) {
        mostrarNotificacion(
            `No hay suficiente stock. Máximo disponible: ${item.stock}.`,
            'error'
        );
        item.cantidad = item.stock;
    } else {
        item.cantidad = cantidad;
    }

    renderizarTablaTicket();
}

function eliminarRenglonTicket(indice) {
    ticketVentaActual.splice(indice, 1);

    if (renglonTicketSeleccionado === indice) {
        renglonTicketSeleccionado = null;
    } else if (renglonTicketSeleccionado > indice) {
        renglonTicketSeleccionado -= 1;
    }

    renderizarTablaTicket();
}

async function registrarVenta() {
    if (!ticketVentaActual.length) {
        mostrarNotificacion(
            'No hay productos en la lista para registrar la salida.',
            'error'
        );
        return;
    }

    try {
        const response = await fetch('/api/vender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productos: ticketVentaActual })
        });

        const data = await response.json();

        if (!response.ok || !data.exito) {
            mostrarNotificacion(
                data.mensaje || 'Error al registrar la salida.',
                'error'
            );
            return;
        }

        mostrarNotificacion(data.mensaje, 'success');
        ticketVentaActual = [];
        renglonTicketSeleccionado = null;
        renderizarTablaTicket();
    } catch (error) {
        console.error('Error al registrar salida:', error);
        mostrarNotificacion('Error de conexión al registrar la salida.', 'error');
    }
}

function cancelarSalidaActual() {
    if (!ticketVentaActual.length) {
        mostrarNotificacion('No hay una salida pendiente para cancelar.', 'info');
        return;
    }

    if (!confirm(
        '¿Deseas cancelar esta salida? Se quitarán los productos del ticket, pero no se modificarán las existencias.'
    )) {
        return;
    }

    ticketVentaActual = [];
    renglonTicketSeleccionado = null;

    const input = document.getElementById('input-codigo-venta');
    const sugerencias = document.getElementById('sugerencias-salida-live');

    if (input) input.value = '';
    if (sugerencias) sugerencias.style.display = 'none';

    renderizarTablaTicket();
    mostrarNotificacion(
        'La salida pendiente se canceló. El inventario no fue modificado.',
        'success'
    );
}


// --- BLOQUE 8: Registro de productos normales y packs ---
function obtenerTipoProductoSeleccionado() {
    return document.getElementById('tipo-pack')?.checked ? 'pack' : 'normal';
}

function alternarTipoProducto() {
    const esPack = obtenerTipoProductoSeleccionado() === 'pack';
    const seccionPack = document.getElementById('seccion-componentes-pack');
    const campoStock = document.getElementById('campo-stock-inicial');
    const stock = document.getElementById('stock');
    const costo = document.getElementById('precio_costo');
    const precio = document.getElementById('precio_venta');

    if (seccionPack) seccionPack.style.display = esPack ? 'block' : 'none';
    if (campoStock) campoStock.style.display = esPack ? 'none' : 'flex';

    if (stock) {
        stock.disabled = esPack;
        stock.required = !esPack;
    }

    if (costo) costo.readOnly = esPack;
    if (precio) precio.readOnly = esPack;

    if (esPack) {
        cargarProductosParaPack();
        actualizarResumenPack();
    } else {
        componentesPackActuales = [];
        renderizarComponentesPack();
        if (costo) costo.readOnly = false;
        if (precio) precio.readOnly = false;
    }
}

async function cargarProductosParaPack() {
    const select = document.getElementById('producto-componente');
    if (!select) return;

    try {
        const response = await fetch('/api/productos/seleccionables');
        const productos = await response.json();

        if (!response.ok) {
            throw new Error(productos.mensaje || 'No se pudieron cargar productos.');
        }

        productosDisponiblesPack = productos;
        select.innerHTML = '<option value="">-- Selecciona un producto --</option>';

        productos.forEach(producto => {
            const option = document.createElement('option');
            option.value = producto.id;
            option.textContent =
                `${producto.codigo_barras} — ${producto.nombre} (Costo: $${Number(producto.precio_costo || 0).toFixed(2)})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar productos para pack:', error);
        mostrarNotificacion(
            'No se pudieron cargar los productos para el pack.',
            'error'
        );
    }
}

function agregarComponentePack() {
    const select = document.getElementById('producto-componente');
    const inputCantidad = document.getElementById('cantidad-componente');

    if (!select || !select.value || !inputCantidad) {
        mostrarNotificacion('Selecciona un producto para el pack.', 'error');
        return;
    }

    const productoId = Number(select.value);
    const cantidad = Number(inputCantidad.value);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        mostrarNotificacion(
            'La cantidad del componente debe ser un entero mayor que cero.',
            'error'
        );
        return;
    }

    const producto = productosDisponiblesPack.find(
        item => Number(item.id) === productoId
    );

    if (!producto) {
        mostrarNotificacion('No se encontró el producto seleccionado.', 'error');
        return;
    }

    const existente = componentesPackActuales.find(
        item => Number(item.producto_id) === productoId
    );

    if (existente) {
        existente.cantidad += cantidad;
    } else {
        componentesPackActuales.push({
            producto_id: productoId,
            codigo_barras: producto.codigo_barras,
            nombre: producto.nombre,
            precio_costo: Number(producto.precio_costo) || 0,
            cantidad
        });
    }

    inputCantidad.value = '1';
    select.value = '';

    renderizarComponentesPack();
    actualizarResumenPack();
}

function quitarComponentePack(productoId) {
    componentesPackActuales = componentesPackActuales.filter(
        item => Number(item.producto_id) !== Number(productoId)
    );

    renderizarComponentesPack();
    actualizarResumenPack();
}

function renderizarComponentesPack() {
    const contenedor = document.getElementById('lista-componentes-pack');
    if (!contenedor) return;

    if (!componentesPackActuales.length) {
        contenedor.innerHTML =
            '<div class="pack-empty">Aún no agregas productos a la composición del pack.</div>';
        return;
    }

    contenedor.innerHTML = `
        <div class="pack-components-table-wrap">
            <table class="pack-components-table">
                <thead>
                    <tr>
                        <th>Producto componente</th>
                        <th>Costo unitario</th>
                        <th>Unidades</th>
                        <th>Costo subtotal</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${componentesPackActuales.map(componente => `
                        <tr>
                            <td>
                                <strong>${escaparHTML(componente.nombre)}</strong>
                                <small>${escaparHTML(componente.codigo_barras)}</small>
                            </td>
                            <td>$${componente.precio_costo.toFixed(2)}</td>
                            <td>${componente.cantidad}</td>
                            <td>$${(componente.precio_costo * componente.cantidad).toFixed(2)}</td>
                            <td>
                                <button
                                    type="button"
                                    class="danger-btn"
                                    onclick="quitarComponentePack(${componente.producto_id})"
                                >Quitar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function actualizarResumenPack() {
    const unidades = componentesPackActuales.reduce(
        (total, componente) => total + componente.cantidad,
        0
    );

    const costoTotal = componentesPackActuales.reduce(
        (total, componente) =>
            total + componente.precio_costo * componente.cantidad,
        0
    );

    const inputUnidades = document.getElementById('unidades-pack');
    const inputCosto = document.getElementById('precio_costo');
    const inputGanancia = document.getElementById('ganancia');
    const inputPrecio = document.getElementById('precio_venta');
    const resumenCosto = document.getElementById('costo-calculado-pack');

    if (inputUnidades) inputUnidades.value = unidades;
    if (inputCosto) inputCosto.value = costoTotal.toFixed(2);
    if (resumenCosto) resumenCosto.textContent = `$${costoTotal.toFixed(2)}`;

    const ganancia = Number(inputGanancia?.value) || 0;
    if (inputPrecio) {
        inputPrecio.value =
            (costoTotal + costoTotal * (ganancia / 100)).toFixed(2);
    }
}

function calcularPrecioVentaDesdCosto() {
    if (obtenerTipoProductoSeleccionado() === 'pack') {
        actualizarResumenPack();
        return;
    }

    const costo = Number(document.getElementById('precio_costo')?.value) || 0;
    const ganancia = Number(document.getElementById('ganancia')?.value) || 0;
    const precio = document.getElementById('precio_venta');

    if (precio) {
        precio.value = (costo + costo * (ganancia / 100)).toFixed(2);
    }
}

function calcularGananciaDesdePrecioVenta() {
    if (obtenerTipoProductoSeleccionado() === 'pack') {
        actualizarResumenPack();
        return;
    }

    const costo = Number(document.getElementById('precio_costo')?.value) || 0;
    const venta = Number(document.getElementById('precio_venta')?.value) || 0;
    const ganancia = document.getElementById('ganancia');

    if (costo > 0 && ganancia) {
        ganancia.value = (((venta - costo) / costo) * 100).toFixed(2);
    }
}

function agregarFechaCaducidad() {
    const contenedor = document.getElementById('contenedor-caducidades');
    if (!contenedor) return;

    const fila = document.createElement('div');
    fila.className = 'caducidad-row';
    fila.innerHTML = `
        <input type="date" class="caducidad-input" aria-label="Fecha de caducidad">
        <button type="button" class="caducidad-remove-btn">Quitar</button>
    `;

    fila.querySelector('button').addEventListener('click', () => fila.remove());
    contenedor.appendChild(fila);
}

function obtenerFechasCaducidad() {
    return [...document.querySelectorAll(
        '#contenedor-caducidades .caducidad-input'
    )]
        .map(input => input.value)
        .filter(Boolean);
}

async function registrarProducto(event) {
    event.preventDefault();

    const tipoProducto = obtenerTipoProductoSeleccionado();
    const tipoVenta = document.getElementById('tipo-granel')?.checked
        ? 'granel'
        : 'unidad';

    const payload = {
        codigo_barras: document.getElementById('codigo')?.value.trim() || '',
        nombre: document.getElementById('nombre')?.value.trim() || '',
        precio_costo: Number(document.getElementById('precio_costo')?.value) || 0,
        ganancia: Number(document.getElementById('ganancia')?.value) || 0,
        precio_venta: Number(document.getElementById('precio_venta')?.value) || 0,
        tipo_venta: tipoVenta,
        tipo_producto: tipoProducto,
        departamento: document.getElementById('departamento')?.value || 'Sin Departamento',
        stock_inicial: tipoProducto === 'pack'
            ? 0
            : Number.parseInt(document.getElementById('stock')?.value || '0', 10),
        stock_minimo: Number.parseInt(
            document.getElementById('stock_minimo')?.value || '1',
            10
        ),
        imagen: document.getElementById('imagen-url')?.value.trim() || '',
        comentario_registro:
            document.getElementById('comentario-registro')?.value.trim() || '',
        caducidades: obtenerFechasCaducidad(),
        componentes: tipoProducto === 'pack'
            ? componentesPackActuales.map(componente => ({
                producto_id: componente.producto_id,
                cantidad: componente.cantidad
            }))
            : []
    };

    if (!payload.codigo_barras || !payload.nombre) {
        mostrarNotificacion('El código y el nombre son obligatorios.', 'error');
        return;
    }

    if (tipoProducto === 'pack' && !payload.componentes.length) {
        mostrarNotificacion(
            'Agrega al menos un componente para registrar el pack.',
            'error'
        );
        return;
    }

    try {
        const response = await fetch('/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'Error al registrar producto.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje || 'Producto registrado con éxito.', 'success');

        const formulario = document.getElementById('form-producto');
        if (formulario) formulario.reset();

        componentesPackActuales = [];
        renderizarComponentesPack();

        const caducidades = document.getElementById('contenedor-caducidades');
        if (caducidades) {
            caducidades.innerHTML = `
                <div class="caducidad-row">
                    <input type="date" class="caducidad-input" aria-label="Fecha de caducidad">
                </div>
            `;
        }

        alternarTipoProducto();
    } catch (error) {
        console.error('Error al registrar producto:', error);
        mostrarNotificacion('Error de conexión al registrar producto.', 'error');
    }
}

function manejarImagenLocal(input) {
    if (!input.files || !input.files[0]) return;

    const lector = new FileReader();

    lector.onload = event => {
        const campo = document.getElementById('imagen-url');
        if (campo) campo.value = event.target.result;
    };

    lector.onerror = () => {
        mostrarNotificacion('No se pudo leer la imagen.', 'error');
    };

    lector.readAsDataURL(input.files[0]);
}


// --- BLOQUE 9: Departamentos ---
async function abrirModalDepartamentos() {
    const modal = document.getElementById('modal-departamentos');
    if (modal) modal.style.display = 'flex';
    await cargarTablaAdminDepartamentos();
}

function cerrarModalDepartamentos() {
    const modal = document.getElementById('modal-departamentos');
    if (modal) modal.style.display = 'none';
    cargarDepartamentosSelect();
}

async function cargarDepartamentosSelect() {
    try {
        const response = await fetch('/api/departamentos');
        const departamentos = await response.json();
        const select = document.getElementById('departamento');
        if (!select) return;

        select.innerHTML = '';

        departamentos.forEach(departamento => {
            const option = document.createElement('option');
            option.value = departamento.nombre;
            option.textContent = departamento.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
    }
}

async function cargarTablaAdminDepartamentos() {
    try {
        const response = await fetch('/api/departamentos');
        const departamentos = await response.json();
        const tbody = document.getElementById('tabla-admin-departamentos-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        departamentos.forEach(departamento => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td>${escaparHTML(departamento.nombre)}</td>
                <td class="table-action-cell">
                    <button
                        type="button"
                        class="danger-btn"
                        onclick="eliminarDepartamento(${departamento.id})"
                    >🗑️ Eliminar</button>
                </td>
            `;
            tbody.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar departamentos:', error);
    }
}

async function guardarNuevoDepartamentoModal(event) {
    event.preventDefault();

    const input = document.getElementById('nuevo-dep-nombre');
    if (!input || !input.value.trim()) return;

    try {
        const response = await fetch('/api/departamentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: input.value })
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'No se pudo guardar el departamento.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje, 'success');
        input.value = '';
        await cargarTablaAdminDepartamentos();
        await cargarDepartamentosSelect();
    } catch (error) {
        console.error('Error al guardar departamento:', error);
        mostrarNotificacion('Error de conexión.', 'error');
    }
}

async function eliminarDepartamento(id) {
    try {
        const response = await fetch(`/api/departamentos/${id}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'No se pudo eliminar.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje, 'success');
        await cargarTablaAdminDepartamentos();
        await cargarDepartamentosSelect();
    } catch (error) {
        console.error('Error al eliminar departamento:', error);
        mostrarNotificacion('Error al eliminar departamento.', 'error');
    }
}


// --- BLOQUE 10: Búsqueda, edición y eliminación de productos ---
function ejecutarBusquedaAutomatica(valor) {
    const sugerencias = document.getElementById('sugerencias-busqueda');
    if (!sugerencias) return;

    if (valor.trim().length < 2) {
        sugerencias.style.display = 'none';
        return;
    }

    fetch(`/api/productos/buscar?q=${encodeURIComponent(valor.trim())}`)
        .then(response => response.json())
        .then(productos => {
            if (!productos.length) {
                sugerencias.style.display = 'none';
                return;
            }

            sugerencias.innerHTML = productos.map(producto => `
                <button
                    type="button"
                    class="product-search-result"
                    data-codigo="${escaparHTML(producto.codigo_barras)}"
                    data-nombre="${escaparHTML(producto.nombre)}"
                    data-precio="${Number(producto.precio_venta) || 0}"
                    data-costo="${Number(producto.precio_costo) || 0}"
                    onclick="seleccionarProductoBusquedaDesdeBoton(this)"
                >
                    <strong>${escaparHTML(producto.codigo_barras)}</strong>
                    — ${escaparHTML(producto.nombre)}
                    ($${(Number(producto.precio_venta) || 0).toFixed(2)})
                </button>
            `).join('');

            sugerencias.style.display = 'block';
        })
        .catch(error => console.error('Error en búsqueda:', error));
}

function seleccionarProductoBusquedaDesdeBoton(boton) {
    seleccionarProductoBusqueda(
        boton.dataset.codigo,
        boton.dataset.nombre,
        Number(boton.dataset.precio),
        Number(boton.dataset.costo)
    );
}

function seleccionarProductoBusqueda(codigo, nombre, precioVenta, precioCosto) {
    const sugerencias = document.getElementById('sugerencias-busqueda');
    const contenedor = document.getElementById('contenedor-resultados-busqueda');

    if (sugerencias) sugerencias.style.display = 'none';
    if (contenedor) contenedor.style.display = 'block';

    document.getElementById('act-codigo-original').value = codigo;
    document.getElementById('act-codigo').value = codigo;
    document.getElementById('act-nombre').value = nombre;
    document.getElementById('act-precio').value = precioVenta;
    document.getElementById('act-compra').value = precioCosto;
}

async function actualizarProducto(event) {
    event.preventDefault();

    const codigoOriginal = document.getElementById('act-codigo-original').value;
    const payload = {
        nuevo_codigo: document.getElementById('act-codigo').value.trim(),
        nombre: document.getElementById('act-nombre').value.trim(),
        precio_venta: Number(document.getElementById('act-precio').value),
        precio_compra: Number(document.getElementById('act-compra').value)
    };

    try {
        const response = await fetch(
            `/api/productos/${encodeURIComponent(codigoOriginal)}`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'Error al actualizar producto.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje, 'success');
        document.getElementById('contenedor-resultados-busqueda').style.display = 'none';
        document.getElementById('input-busqueda-producto').value = '';
    } catch (error) {
        console.error('Error al actualizar producto:', error);
        mostrarNotificacion('Error de conexión al actualizar.', 'error');
    }
}

async function eliminarProducto(event) {
    event.preventDefault();

    const codigo = document.getElementById('del-codigo').value.trim();
    if (!confirm(`¿Eliminar el producto con código / SKU ${codigo}?`)) return;

    try {
        const response = await fetch(
            `/api/productos/${encodeURIComponent(codigo)}`,
            { method: 'DELETE' }
        );
        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'Error al eliminar producto.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje, 'success');
        event.target.reset();
    } catch (error) {
        console.error('Error al eliminar producto:', error);
        mostrarNotificacion('Error al eliminar producto.', 'error');
    }
}


// --- BLOQUE 11: Inventario, filtro, exportación e impresión ---
function cambiarSubInventario(subseccion, boton) {
    document.querySelectorAll('#vista-inventario .sub-section').forEach(seccion => {
        seccion.classList.remove('active');
        seccion.style.display = 'none';
    });

    document.querySelectorAll('#vista-inventario .sub-btn').forEach(item => {
        item.classList.remove('active');
    });

    const destino = document.getElementById(`sub-inv-${subseccion}`);
    if (destino) {
        destino.classList.add('active');
        destino.style.display = 'block';
    }

    if (boton) boton.classList.add('active');
    if (subseccion === 'productos') cargarInventarioCompleto();
}

async function cargarInventarioCompleto() {
    try {
        const response = await fetch('/api/inventario');
        const productos = await response.json();

        if (!response.ok) {
            throw new Error(productos.mensaje || 'No se pudo cargar inventario.');
        }

        inventarioGlobalCache = productos;

        let totalInvertido = 0;
        let totalExistencia = 0;

        productos.forEach(producto => {
            const costo = Number(producto.precio_costo) || 0;
            const stock = Number(producto.stock) || 0;
            totalInvertido += costo * stock;
            totalExistencia += stock;
        });

        const total = document.getElementById('inv-total-invertido');
        const existencia = document.getElementById('inv-total-existencia');

        if (total) total.textContent = `$${totalInvertido.toFixed(2)}`;
        if (existencia) existencia.textContent = totalExistencia;

        popularFiltroDepartamentos(productos);
        renderizarTablaInventario(productos);
    } catch (error) {
        console.error('Error al cargar inventario:', error);
        mostrarNotificacion('No se pudo cargar el inventario.', 'error');
    }
}

function popularFiltroDepartamentos(productos) {
    const select = document.getElementById('filtro-depto-inventario');
    if (!select) return;

    const departamentoActual = select.value;
    const departamentos = [...new Set(
        productos.map(item => item.departamento || 'Sin Departamento')
    )];

    select.innerHTML = '<option value="">-- Todos los Departamentos --</option>';

    departamentos.forEach(nombre => {
        const option = document.createElement('option');
        option.value = nombre;
        option.textContent = nombre;
        select.appendChild(option);
    });

    if (departamentos.includes(departamentoActual)) {
        select.value = departamentoActual;
    }
}

function filtrarInventarioPorDepartamento() {
    const select = document.getElementById('filtro-depto-inventario');
    const departamento = select ? select.value : '';

    const productos = departamento
        ? inventarioGlobalCache.filter(
            item => (item.departamento || 'Sin Departamento') === departamento
        )
        : inventarioGlobalCache;

    renderizarTablaInventario(productos);
}

function renderizarTablaInventario(productos) {
    const tbody = document.getElementById('tabla-inventario-completo');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!productos.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table-message">
                    No hay productos registrados en inventario.
                </td>
            </tr>
        `;
        return;
    }

    productos.forEach(producto => {
        const fila = document.createElement('tr');
        const stock = Number(producto.stock) || 0;
        const minimo = Number(producto.stock_minimo) || 1;

        fila.innerHTML = `
            <td>${escaparHTML(producto.codigo_barras)}</td>
            <td>
                ${producto.imagen
                    ? `<img src="${escaparHTML(producto.imagen)}" alt="" class="inventory-thumbnail">`
                    : '📦'}
                ${escaparHTML(producto.nombre)}
            </td>
            <td>$${(Number(producto.precio_costo) || 0).toFixed(2)}</td>
            <td>$${(Number(producto.precio_venta) || 0).toFixed(2)}</td>
            <td class="${stock <= minimo ? 'stock-low' : 'stock-ok'}">${stock}</td>
            <td>${escaparHTML(producto.departamento || 'Sin Departamento')}</td>
        `;

        fila.addEventListener('click', () => seleccionarFilaInventario(fila, producto));
        tbody.appendChild(fila);
    });
}

function seleccionarFilaInventario(fila, producto) {
    document.querySelectorAll('#tabla-inventario-completo tr').forEach(item => {
        item.classList.remove('inventory-row-selected');
    });

    fila.classList.add('inventory-row-selected');
    productoInventarioSeleccionado = producto;
}

function mostrarPreviewImg(event, url) {
    let preview = document.getElementById('tooltip-img-preview');

    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'tooltip-img-preview';
        preview.className = 'image-preview-tooltip';
        document.body.appendChild(preview);
    }

    preview.innerHTML = `<img src="${escaparHTML(url)}" alt="Vista previa">`;
    preview.style.display = 'block';
    preview.style.left = `${event.clientX + 15}px`;
    preview.style.top = `${event.clientY + 15}px`;
}

function ocultarPreviewImg() {
    const preview = document.getElementById('tooltip-img-preview');
    if (preview) preview.style.display = 'none';
}

function irAModificarProductoSeleccionado() {
    if (!productoInventarioSeleccionado) {
        mostrarNotificacion('Selecciona un producto de la tabla para modificar.', 'error');
        return;
    }

    const botonProductos = document.querySelector(
        '#barra-navegacion .nav-btn[onclick*="productos"]'
    );

    cambiarVista('productos', botonProductos);

    const botonBusqueda = document.querySelector(
        '#submenu-productos [data-subproducto="buscar-actualizar"]'
    );
    cambiarSubProducto('buscar-actualizar', botonBusqueda);

    const input = document.getElementById('input-busqueda-producto');
    if (input) {
        input.value = productoInventarioSeleccionado.codigo_barras;
        ejecutarBusquedaAutomatica(input.value);
    }
}

function exportarInventarioCSV() {
    const filtro = document.getElementById('filtro-depto-inventario')?.value || '';
    const productos = filtro
        ? inventarioGlobalCache.filter(
            item => (item.departamento || 'Sin Departamento') === filtro
        )
        : inventarioGlobalCache;

    if (!productos.length) {
        mostrarNotificacion('No hay datos para exportar.', 'error');
        return;
    }

    const filas = [
        ['CodigoSKU', 'Producto', 'Costo', 'PrecioReferencia', 'Existencia', 'Departamento'],
        ...productos.map(item => [
            item.codigo_barras,
            item.nombre,
            item.precio_costo || 0,
            item.precio_venta || 0,
            item.stock || 0,
            item.departamento || 'Sin Departamento'
        ])
    ];

    const contenido = filas
        .map(fila => fila.map(valor =>
            `"${String(valor).replace(/"/g, '""')}"`
        ).join(','))
        .join('\n');

    const blob = new Blob(['\uFEFF', contenido], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');

    enlace.href = url;
    enlace.download =
        `inventario_${filtro ? filtro.toLowerCase().replace(/\s+/g, '_') : 'general'}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);

    mostrarNotificacion('Archivo exportado con éxito.', 'success');
}

function abrirOpcionesImpresion() {
    const filtro = document.getElementById('filtro-depto-inventario')?.value || '';
    const productos = filtro
        ? inventarioGlobalCache.filter(
            item => (item.departamento || 'Sin Departamento') === filtro
        )
        : inventarioGlobalCache;

    if (!productos.length) {
        mostrarNotificacion('No hay productos para imprimir.', 'error');
        return;
    }

    const ventana = window.open('', '_blank');
    if (!ventana) {
        mostrarNotificacion('Permite ventanas emergentes para imprimir.', 'error');
        return;
    }

    const titulo = filtro
        ? `Reporte de Inventario - ${filtro}`
        : 'Reporte General de Inventario';

    const totalCosto = productos.reduce(
        (total, item) =>
            total + (Number(item.precio_costo) || 0) * (Number(item.stock) || 0),
        0
    );

    const filas = productos.map(item => `
        <tr>
            <td>${escaparHTML(item.codigo_barras)}</td>
            <td>${escaparHTML(item.nombre)}</td>
            <td>$${(Number(item.precio_costo) || 0).toFixed(2)}</td>
            <td>$${(Number(item.precio_venta) || 0).toFixed(2)}</td>
            <td>${Number(item.stock) || 0}</td>
            <td>${escaparHTML(item.departamento || 'Sin Departamento')}</td>
        </tr>
    `).join('');

    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>${escaparHTML(titulo)}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h2 { text-align: center; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
                th { background: #f1f5f9; }
            </style>
        </head>
        <body>
            <h2>${escaparHTML(titulo)}</h2>
            <p>Fecha: ${new Date().toLocaleString('es-MX')}</p>
            <table>
                <thead>
                    <tr>
                        <th>Código / SKU</th>
                        <th>Descripción</th>
                        <th>Costo</th>
                        <th>Precio Referencia</th>
                        <th>Existencia</th>
                        <th>Departamento</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <h3>Inversión total en costo: $${totalCosto.toFixed(2)}</h3>
        </body>
        </html>
    `);

    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 500);
}


// --- BLOQUE 12: Administración de usuarios ---
async function cargarTablaUsuariosAdmin() {
    try {
        const response = await fetch('/api/usuarios');
        const usuarios = await response.json();
        const tbody = document.getElementById('tabla-usuarios-admin-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!usuarios.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-table-message">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;
            return;
        }

        usuarios.forEach(usuario => {
            const fila = document.createElement('tr');

            fila.innerHTML = `
                <td>${usuario.id}</td>
                <td>${escaparHTML(usuario.usuario)}</td>
                <td>${escaparHTML(usuario.nombre_completo)}</td>
                <td class="table-action-cell">
                    <button
                        type="button"
                        class="action-btn"
                        data-id="${usuario.id}"
                        data-usuario="${escaparHTML(usuario.usuario)}"
                        data-nombre="${escaparHTML(usuario.nombre_completo)}"
                        onclick="abrirModalEditarUsuarioDesdeBoton(this)"
                    >✏️ Editar</button>
                </td>
            `;

            tbody.appendChild(fila);
        });
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

function abrirModalRegistroFromMenu() {
    const modal = document.getElementById('modal-registro-usuario');
    if (modal) modal.style.display = 'flex';
}

function abrirModalRegistroDesdeLogin() {
    abrirModalRegistroFromMenu();
}

function cerrarModalRegistro() {
    const modal = document.getElementById('modal-registro-usuario');
    if (modal) modal.style.display = 'none';
}

async function registrarNuevoUsuario(event) {
    event.preventDefault();

    const payload = {
        usuario: document.getElementById('nuevo-usu-user').value.trim(),
        nombre_completo: document.getElementById('nuevo-usu-nombre').value.trim(),
        password: document.getElementById('nuevo-usu-pass').value
    };

    try {
        const response = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'No se pudo registrar el usuario.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje || 'Usuario registrado.', 'success');
        cerrarModalRegistro();
        document.getElementById('form-nuevo-usuario')?.reset();
        await cargarUsuariosLogin();
        await cargarTablaUsuariosAdmin();
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        mostrarNotificacion('Error de conexión.', 'error');
    }
}

function abrirModalEditarUsuarioDesdeBoton(boton) {
    abrirModalEditarUsuario(
        boton.dataset.id,
        boton.dataset.usuario,
        boton.dataset.nombre
    );
}

function abrirModalEditarUsuario(id, usuario, nombreCompleto) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-user').value = usuario;
    document.getElementById('edit-nombre').value = nombreCompleto;
    document.getElementById('edit-pass').value = '';

    const modal = document.getElementById('modal-editar-usuario');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalEditar() {
    const modal = document.getElementById('modal-editar-usuario');
    if (modal) modal.style.display = 'none';
}

async function guardarEdicionUsuario(event) {
    event.preventDefault();

    const id = document.getElementById('edit-id').value;
    const payload = {
        usuario: document.getElementById('edit-user').value.trim(),
        nombre_completo: document.getElementById('edit-nombre').value.trim(),
        password: document.getElementById('edit-pass').value
    };

    try {
        const response = await fetch(`/api/admin/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            mostrarNotificacion(data.mensaje || 'Error al guardar cambios.', 'error');
            return;
        }

        mostrarNotificacion(data.mensaje || 'Usuario actualizado.', 'success');
        cerrarModalEditar();
        await cargarTablaUsuariosAdmin();
        await cargarUsuariosLogin();
    } catch (error) {
        console.error('Error al editar usuario:', error);
        mostrarNotificacion('Error de conexión al guardar cambios.', 'error');
    }
}
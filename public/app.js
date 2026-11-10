// --- BLOQUE 1: Variables Globales y Estado de Aplicación ---
let usuarioActual = null;
let ticketVentaActual = [];
let renglonTicketSeleccionado = null;

// --- BLOQUE 2: Sistema de Notificaciones Flotantes (Toasts) ---
function mostrarNotificacion(mensaje, tipo = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${tipo}`;
    
    let icono = 'ℹ️';
    if (tipo === 'success') icono = '✔';
    if (tipo === 'error') icono = '✖';

    toast.innerHTML = `<span style="font-weight: bold; font-size: 16px;">${icono}</span> <span>${mensaje}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// --- BLOQUE 3: Inicialización del Sistema, Fecha/Hora, Escáner USB y Control de Tema ---
window.addEventListener('DOMContentLoaded', () => {
    actualizarReloj();
    setInterval(actualizarReloj, 1000);
    cargarUsuariosLogin();
    cargarDepartamentosSelect();

    const inputCodigo = document.getElementById('input-codigo-venta');
    if (inputCodigo) {
        inputCodigo.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const sug = document.getElementById('sugerencias-salida-live');
                if (sug) sug.style.display = 'none';
                agregarAlTicketSimulado();
            }
        });
    }

    // --- Soporte Global para Escáner de Código de Barras Físico (USB / Bluetooth) ---
    let bufferCodigoBarras = '';
    let ultimoTiempoEscaneo = Date.now();

    window.addEventListener('keypress', (e) => {
        const tiempoActual = Date.now();
        const activo = document.activeElement;
        const activoTag = activo ? activo.tagName : '';

        // Si el usuario está escribiendo activamente en un campo de texto que NO sea el buscador de ventas, ignorar escáner global
        if (activoTag === 'TEXTAREA' || (activoTag === 'INPUT' && activo.id !== 'input-codigo-venta')) {
            return;
        }

        // Los escáneres escriben caracteres muy rápido (< 50ms entre tecla y tecla)
        if (tiempoActual - ultimoTiempoEscaneo > 100) {
            bufferCodigoBarras = ''; // Reiniciar si transcurrió mucho tiempo (escritura manual)
        }

        ultimoTiempoEscaneo = tiempoActual;

        if (e.key === 'Enter') {
            if (bufferCodigoBarras.trim().length > 1) {
                e.preventDefault();
                
                // Asignar el código escaneado al input de búsqueda
                if (inputCodigo) {
                    inputCodigo.value = bufferCodigoBarras.trim();
                }
                
                const sug = document.getElementById('sugerencias-salida-live');
                if (sug) sug.style.display = 'none';
                
                // Procesar la adición al ticket
                agregarAlTicketSimulado();
            }
            bufferCodigoBarras = '';
        } else if (e.key.length === 1) {
            bufferCodigoBarras += e.key;
        }
    });

    // Evento de teclado para borrar elemento seleccionado al presionar "Delete" / "Suprimir"
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Supr') {
            if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'SELECT')) {
                return;
            }
            if (renglonTicketSeleccionado !== null && renglonTicketSeleccionado >= 0 && renglonTicketSeleccionado < ticketVentaActual.length) {
                const nombreProd = ticketVentaActual[renglonTicketSeleccionado].nombre;
                eliminarRenglonTicket(renglonTicketSeleccionado);
                mostrarNotificacion(`"${nombreProd}" eliminado con la tecla Suprimir.`, "info");
            }
        }
    });

    // Ocultar la lista flotante de búsqueda al hacer clic fuera
    document.addEventListener('click', (e) => {
        const sug = document.getElementById('sugerencias-salida-live');
        const input = document.getElementById('input-codigo-venta');
        if (sug && input && !sug.contains(e.target) && e.target !== input) {
            sug.style.display = 'none';
        }
    });

    const temaGuardado = localStorage.getItem('pos_theme');
    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
        const icono = document.getElementById('icono-modo-tema');
        if (icono) icono.innerText = '☀️';
    }
});

function actualizarReloj() {
    const ahora = new Date();
    const elFecha = document.getElementById('fecha-actual');
    const elHora = document.getElementById('hora-actual');
    if (elFecha) elFecha.innerText = ahora.toLocaleDateString('es-MX', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    if (elHora) elHora.innerText = ahora.toLocaleTimeString('es-MX');
}

function alternarModoOscuro() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    const icono = document.getElementById('icono-modo-tema');
    
    if (body.classList.contains('dark-mode')) {
        if (icono) icono.innerText = '☀️';
        localStorage.setItem('pos_theme', 'dark');
        mostrarNotificacion("Modo obscuro activado.", "info");
    } else {
        if (icono) icono.innerText = '🌙';
        localStorage.setItem('pos_theme', 'light');
        mostrarNotificacion("Modo claro activado.", "info");
    }
}

// --- BLOQUE 3.1: Autenticación y Menú de Usuarios ---
async function cargarUsuariosLogin() {
    try {
        const res = await fetch('/api/usuarios');
        const usuarios = await res.json();
        const select = document.getElementById('login-select-usuario');
        if (!select) return;

        let html = '<option value="">-- Seleccione un usuario --</option>';
        usuarios.forEach(u => {
            html += `<option value="${u.usuario}">${u.nombre_completo} (${u.usuario})</option>`;
        });
        html += `<option value="__otro__">➕ Escribir otro usuario...</option>`;
        select.innerHTML = html;
    } catch (error) {
        console.error("Error al cargar usuarios para login:", error);
    }
}

function seleccionarUsuarioLogin(selectEl) {
    const contenedorInput = document.getElementById('contenedor-input-usuario');
    const inputUsu = document.getElementById('login-usuario');
    if (selectEl.value === '__otro__') {
        if (contenedorInput) contenedorInput.style.display = 'block';
        if (inputUsu) {
            inputUsu.value = '';
            inputUsu.focus();
        }
    } else {
        if (contenedorInput) contenedorInput.style.display = 'none';
        if (inputUsu) inputUsu.value = selectEl.value;
    }
}

function toggleMenuUsuario(event) {
    event.stopPropagation();
    const menu = document.getElementById('user-menu');
    if (menu) {
        menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
    }
}

function cerrarSesion() {
    usuarioActual = null;
    ticketVentaActual = [];
    renglonTicketSeleccionado = null;
    renderizarTablaTicket();

    const vistaLogin = document.getElementById('vista-login');
    const sistemaPrincipal = document.getElementById('sistema-principal');
    if (vistaLogin) {
        vistaLogin.classList.remove('oculto');
        vistaLogin.style.display = 'flex';
    }
    if (sistemaPrincipal) {
        sistemaPrincipal.classList.add('oculto');
        sistemaPrincipal.style.display = 'none';
    }
    const pass = document.getElementById('login-password');
    if (pass) pass.value = '';
    cargarUsuariosLogin();
    mostrarNotificacion("Sesión cerrada correctamente.", "info");
}

function cambiarUsuarioModal() {
    cerrarSesion();
}

async function autenticarUsuario(e) {
    e.preventDefault();
    const select = document.getElementById('login-select-usuario');
    const inputUsu = document.getElementById('login-usuario');
    const password = document.getElementById('login-password').value;

    let usuario = select ? select.value : '';
    if (usuario === '__otro__' || !usuario) {
        usuario = inputUsu ? inputUsu.value : '';
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, password })
        });
        const data = await res.json();

        if (res.ok) {
            usuarioActual = data.usuario;
            
            const vistaLogin = document.getElementById('vista-login');
            if (vistaLogin) {
                vistaLogin.classList.add('oculto');
                vistaLogin.style.display = 'none';
            }

            const sistemaPrincipal = document.getElementById('sistema-principal');
            if (sistemaPrincipal) {
                sistemaPrincipal.classList.remove('oculto');
                sistemaPrincipal.style.display = 'block';
            }

            const nombreEl = document.getElementById('nombre-usuario');
            const avatarEl = document.getElementById('avatar-inicial');
            if (nombreEl) nombreEl.innerText = usuarioActual;
            if (avatarEl) avatarEl.innerText = usuarioActual.charAt(0).toUpperCase();

            const btnAdmin = document.getElementById('btn-tab-admin');
            if (btnAdmin) {
                const nombreUsuLower = (usuario || '').toLowerCase();
                btnAdmin.style.display = (nombreUsuLower === 'admin' || nombreUsuLower === 'administrador') ? 'inline-block' : 'none';
            }

            mostrarNotificacion(`Bienvenido, ${usuarioActual}`, "success");
        } else {
            mostrarNotificacion(data.mensaje || "Credenciales incorrectas.", "error");
        }
    } catch (err) {
        console.error("Error en login:", err);
        mostrarNotificacion("Error de conexión con el servidor.", "error");
    }
}

// --- BLOQUE 5: Navegación de Vistas ---
function cambiarVista(nombreVista, botonElemento) {
    document.querySelectorAll('.view-section').forEach(vista => {
        vista.classList.remove('active');
        vista.style.display = 'none';
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const vistaDestino = document.getElementById(`vista-${nombreVista}`);
    if (vistaDestino) {
        vistaDestino.classList.add('active');
        vistaDestino.style.display = 'block';
    }

    if (botonElemento) {
        botonElemento.classList.add('active');
    }

    if (nombreVista === 'inventario') {
        cargarInventarioCompleto();
    } else if (nombreVista === 'admin-usuarios') {
        cargarTablaUsuariosAdmin();
    }
}

function cambiarSubProducto(subseccion, boton) {
    document.querySelectorAll('#vista-productos .sub-section').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('#vista-productos .sub-btn').forEach(b => b.classList.remove('active'));

    const obj = document.getElementById(`sub-${subseccion}`);
    if (obj) {
        obj.classList.add('active');
        obj.style.display = 'block';
    }
    if (boton) boton.classList.add('active');
}

// --- BLOQUE 6: Control de Salidas e-commerce y Búsqueda estilo Google ---
function buscarProductosTiempoReal(val) {
    const sug = document.getElementById('sugerencias-salida-live');
    if (!sug) return;
    const query = val.trim();

    if (query.length < 1) {
        sug.style.display = 'none';
        return;
    }

    fetch(`/api/productos/buscar?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(productos => {
            if (productos.length === 0) {
                sug.innerHTML = `<div style="padding: 12px; color: var(--text-muted); font-size: 13px; text-align: center;">No se encontraron coincidencias.</div>`;
                sug.style.display = 'block';
                return;
            }

            let html = '';
            productos.forEach(p => {
                const imgTag = (p.imagen && p.imagen.trim() !== '') 
                    ? `<img src="${p.imagen}" style="width: 42px; height: 42px; object-fit: contain; border-radius: 6px; background: #ffffff; border: 1px solid var(--border-color); flex-shrink: 0;">` 
                    : `<div style="width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; background: var(--table-bg); border-radius: 6px; font-size: 20px; flex-shrink: 0;">📦</div>`;

                const stockColor = (p.stock || 0) > 0 ? '#16a34a' : '#dc2626';

                html += `
                    <div onclick="seleccionarProductoDeBuscador('${p.codigo_barras}')" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; cursor: pointer; border-bottom: 1px solid var(--border-color); transition: background 0.2s;" onmouseover="this.style.background='var(--table-bg)'" onmouseout="this.style.background='transparent'">
                        ${imgTag}
                        <div style="flex: 1; overflow: hidden;">
                            <div style="font-weight: 600; font-size: 14px; color: var(--text-main); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p.nombre}</div>
                            <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">SKU: ${p.codigo_barras}</div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <div style="font-weight: bold; color: var(--primary); font-size: 14px;">$${(p.precio_venta || 0).toFixed(2)}</div>
                            <div style="font-size: 11px; font-weight: 600; color: ${stockColor};">Stock: ${p.stock || 0}</div>
                        </div>
                    </div>
                `;
            });

            sug.innerHTML = html;
            sug.style.display = 'block';
        })
        .catch(err => console.error("Error en búsqueda en vivo:", err));
}

function seleccionarProductoDeBuscador(codigo) {
    const input = document.getElementById('input-codigo-venta');
    if (input) input.value = codigo;
    const sug = document.getElementById('sugerencias-salida-live');
    if (sug) sug.style.display = 'none';
    agregarAlTicketSimulado();
}

// Variable bandera para evitar doble ejecución ante colisiones de eventos
let procesandoAgregar = false;

async function agregarAlTicketSimulado() {
    if (procesandoAgregar) return;

    const input = document.getElementById('input-codigo-venta');
    if (!input || !input.value.trim()) return;

    const codigo = input.value.trim();
    procesandoAgregar = true;

    try {
        const res = await fetch(`/api/productos/buscar?q=${encodeURIComponent(codigo)}`);
        const productos = await res.json();

        if (productos.length === 0) {
            mostrarNotificacion(`Producto con código / SKU "${codigo}" no encontrado.`, "error");
            procesandoAgregar = false;
            return;
        }

        const producto = productos.find(p => p.codigo_barras === codigo) || productos[0];

        if (producto.stock <= 0) {
            mostrarNotificacion(`El producto "${producto.nombre}" no tiene stock disponible.`, "error");
            procesandoAgregar = false;
            return;
        }

        const existeIndex = ticketVentaActual.findIndex(item => item.id === producto.id);
        if (existeIndex >= 0) {
            if (ticketVentaActual[existeIndex].cantidad + 1 > producto.stock) {
                mostrarNotificacion(`Límite de stock alcanzado para "${producto.nombre}".`, "error");
                procesandoAgregar = false;
                return;
            }
            ticketVentaActual[existeIndex].cantidad += 1;
        } else {
            ticketVentaActual.push({
                id: producto.id,
                codigo_barras: producto.codigo_barras,
                nombre: producto.nombre,
                precio_venta: producto.precio_venta,
                stock: producto.stock,
                imagen: producto.imagen || '',
                cantidad: 1
            });
        }

        // Limpiar completamente el cuadro de entrada tras registrar
        input.value = '';
        const sug = document.getElementById('sugerencias-salida-live');
        if (sug) sug.style.display = 'none';

        renderizarTablaTicket();
        mostrarNotificacion(`"${producto.nombre}" agregado al control de salida.`, "success");
    } catch (err) {
        mostrarNotificacion("Error de conexión al agregar producto.", "error");
    } finally {
        procesandoAgregar = false;
    }
}

function renderizarTablaTicket() {
    const tbody = document.getElementById('tabla-ticket-body');
    const txtTotal = document.getElementById('total-ticket-txt');
    const txtContador = document.getElementById('contador-articulos');
    if (!tbody) return;

    tbody.innerHTML = '';
    let totalGeneral = 0;
    let cantidadArticulos = 0;

    if (ticketVentaActual.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">La lista de salida está vacía. Escanee o agregue un artículo.</td></tr>`;
        if (txtTotal) txtTotal.innerText = '$0.00';
        if (txtContador) txtContador.innerText = '0 Artículos en la salida actual.';
        renglonTicketSeleccionado = null;
        return;
    }

    ticketVentaActual.forEach((item, index) => {
        const importe = item.precio_venta * item.cantidad;
        totalGeneral += importe;
        cantidadArticulos += item.cantidad;

        const imgThumbnail = (item.imagen && item.imagen.trim() !== '') 
            ? `<img src="${item.imagen}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; background: #ffffff; border: 1px solid var(--border-color); display: block; margin: 0 auto; cursor: pointer;" onmouseover="mostrarPreviewImg(event, '${item.imagen}')" onmouseout="ocultarPreviewImg()">` 
            : `<div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: var(--table-bg); border-radius: 6px; font-size: 22px; margin: 0 auto; border: 1px solid var(--border-color);">📦</div>`;

        const esSeleccionado = (renglonTicketSeleccionado === index);
        const estiloFila = esSeleccionado ? 'background: rgba(79, 70, 229, 0.15); border-left: 4px solid var(--primary);' : '';

        const stockDisponiblePza = item.stock - item.cantidad;

        const tr = document.createElement('tr');
        tr.style.cssText = `cursor: pointer; transition: background 0.15s; ${estiloFila}`;
        tr.onclick = () => seleccionarFilaTicket(index);

        tr.innerHTML = `
            <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: center;">${imgThumbnail}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-family: monospace;">${item.codigo_barras}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: 500;">${item.nombre}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: bold; color: var(--primary);">$${item.precio_venta.toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color);" onclick="event.stopPropagation()">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <input type="number" min="1" max="${item.stock}" value="${item.cantidad}" onchange="modificarCantidadTicket(${index}, this.value)" style="width: 65px; padding: 6px; border-radius: 6px; border: 1px solid var(--border-color); text-align: center; font-weight: bold; background: var(--input-bg); color: var(--text-main);">
                    <span style="font-size: 11px; color: var(--text-muted); font-weight: 600; white-space: nowrap;">(Stock disp: <strong style="color: ${stockDisponiblePza > 0 ? '#16a34a' : '#dc2626'}">${stockDisponiblePza}</strong>)</span>
                </div>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: bold; color: #16a34a;">$${importe.toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: center;" onclick="event.stopPropagation()">
                <button onclick="eliminarRenglonTicket(${index})" title="Eliminar fila" style="background: #dc2626; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    if (txtTotal) txtTotal.innerText = `$${totalGeneral.toFixed(2)}`;
    if (txtContador) txtContador.innerText = `${cantidadArticulos} Artículo(s) en la salida actual.`;
}

function seleccionarFilaTicket(index) {
    renglonTicketSeleccionado = index;
    renderizarTablaTicket();
}

function modificarCantidadTicket(index, nuevaCantidad) {
    const cant = parseInt(nuevaCantidad);
    if (isNaN(cant) || cant <= 0) {
        eliminarRenglonTicket(index);
        return;
    }
    if (cant > ticketVentaActual[index].stock) {
        mostrarNotificacion(`No hay suficiente stock. Máximo disponible: ${ticketVentaActual[index].stock}`, "error");
        ticketVentaActual[index].cantidad = ticketVentaActual[index].stock;
    } else {
        ticketVentaActual[index].cantidad = cant;
    }
    renderizarTablaTicket();
}

function eliminarRenglonTicket(index) {
    ticketVentaActual.splice(index, 1);
    if (renglonTicketSeleccionado === index) {
        renglonTicketSeleccionado = null;
    } else if (renglonTicketSeleccionado > index) {
        renglonTicketSeleccionado--;
    }
    renderizarTablaTicket();
}

async function registrarVenta() {
    if (ticketVentaActual.length === 0) {
        mostrarNotificacion("No hay productos en la lista para registrar la salida.", "error");
        return;
    }

    try {
        const res = await fetch('/api/vender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productos: ticketVentaActual })
        });
        const data = await res.json();

        if (res.ok && data.exito) {
            mostrarNotificacion(data.mensaje, "success");
            ticketVentaActual = [];
            renglonTicketSeleccionado = null;
            renderizarTablaTicket();
        } else {
            mostrarNotificacion(data.mensaje || "Error al registrar la salida de inventario.", "error");
        }
    } catch (err) {
        mostrarNotificacion("Error de conexión al registrar la salida.", "error");
    }
}

// --- BLOQUE 7: Gestión de Productos (Precios y Formularios) ---
function calcularPrecioVentaDesdCosto() {
    const costo = parseFloat(document.getElementById('precio_costo').value) || 0;
    const ganancia = parseFloat(document.getElementById('ganancia').value) || 0;
    const precioVenta = costo + (costo * (ganancia / 100));
    document.getElementById('precio_venta').value = precioVenta.toFixed(2);
}

function calcularGananciaDesdePrecioVenta() {
    const costo = parseFloat(document.getElementById('precio_costo').value) || 0;
    const venta = parseFloat(document.getElementById('precio_venta').value) || 0;
    if (costo > 0) {
        const ganancia = ((venta - costo) / costo) * 100;
        document.getElementById('ganancia').value = ganancia.toFixed(2);
    }
}

async function registrarProducto(e) {
    e.preventDefault();
    const codigo_barras = document.getElementById('codigo').value;
    const nombre = document.getElementById('nombre').value;
    const precio_costo = parseFloat(document.getElementById('precio_costo').value) || 0;
    const ganancia = parseFloat(document.getElementById('ganancia').value) || 100;
    const precio_venta = parseFloat(document.getElementById('precio_venta').value) || 0;
    const departamento = document.getElementById('departamento').value;
    const stock_inicial = parseInt(document.getElementById('stock').value) || 1;
    const stock_minimo = parseInt(document.getElementById('stock_minimo').value) || 1;
    const imagen = document.getElementById('imagen-url').value;

    let tipo_venta = 'unidad';
    if (document.getElementById('tipo-granel').checked) tipo_venta = 'granel';

    try {
        const res = await fetch('/api/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codigo_barras, nombre, precio_costo, ganancia, precio_venta, tipo_venta, departamento, stock_inicial, stock_minimo, imagen })
        });
        const data = await res.json();
        if (res.ok) {
            mostrarNotificacion(data.mensaje, "success");
            e.target.reset();
        } else {
            mostrarNotificacion(data.mensaje || "Error al registrar producto.", "error");
        }
    } catch (err) {
        mostrarNotificacion("Error de conexión al registrar producto.", "error");
    }
}

function manejarImagenLocal(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('imagen-url').value = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// --- BLOQUE 8: Gestión de Departamentos ---
async function abrirModalDepartamentos() {
    const modal = document.getElementById('modal-departamentos');
    if (modal) {
        modal.style.display = 'flex';
        cargarTablaAdminDepartamentos();
    }
}

function cerrarModalDepartamentos() {
    const modal = document.getElementById('modal-departamentos');
    if (modal) modal.style.display = 'none';
    cargarDepartamentosSelect();
}

async function cargarDepartamentosSelect() {
    try {
        const res = await fetch('/api/departamentos');
        const deps = await res.json();
        const select = document.getElementById('departamento');
        if (!select) return;
        let html = '';
        deps.forEach(d => {
            html += `<option value="${d.nombre}">${d.nombre}</option>`;
        });
        select.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar departamentos", err);
    }
}

async function cargarTablaAdminDepartamentos() {
    try {
        const res = await fetch('/api/departamentos');
        const deps = await res.json();
        const tbody = document.getElementById('tabla-admin-departamentos-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        deps.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color);">${d.nombre}</td>
                <td style="padding: 8px 12px; border-bottom: 1px solid var(--border-color); text-align: right;">
                    <button type="button" onclick="eliminarDepartamento(${d.id})" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">🗑️ Eliminar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al cargar admin departamentos", err);
    }
}

async function guardarNuevoDepartamentoModal(e) {
    e.preventDefault();
    const input = document.getElementById('nuevo-dep-nombre');
    if (input && input.value) {
        try {
            const res = await fetch('/api/departamentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre: input.value })
            });
            const data = await res.json();
            if (res.ok) {
                mostrarNotificacion(data.mensaje, "success");
                input.value = '';
                cargarTablaAdminDepartamentos();
            } else {
                mostrarNotificacion(data.mensaje, "error");
            }
        } catch (err) {
            mostrarNotificacion("Error de conexión.", "error");
        }
    }
}

async function eliminarDepartamento(id) {
    try {
        const res = await fetch(`/api/departamentos/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            mostrarNotificacion(data.mensaje, "success");
            cargarTablaAdminDepartamentos();
        } else {
            mostrarNotificacion(data.mensaje, "error");
        }
    } catch (err) {
        mostrarNotificacion("Error al eliminar departamento.", "error");
    }
}

// --- BLOQUE 9: Búsqueda Automática y Edición de Productos ---
function ejecutarBusquedaAutomatica(val) {
    const sug = document.getElementById('sugerencias-busqueda');
    if (!sug) return;
    if (val.length < 2) {
        sug.style.display = 'none';
        return;
    }
    
    fetch(`/api/productos/buscar?q=${encodeURIComponent(val)}`)
        .then(res => res.json())
        .then(productos => {
            if (productos.length === 0) {
                sug.style.display = 'none';
                return;
            }
            let html = '';
            productos.forEach(p => {
                html += `<div style="padding: 10px; cursor: pointer; border-bottom: 1px solid var(--border-color);" onclick="seleccionarProductoBusqueda('${p.codigo_barras}', '${p.nombre.replace(/'/g, "\\'")}', ${p.precio_venta}, ${p.precio_costo || 0})"><strong>${p.codigo_barras}</strong> - ${p.nombre} ($${p.precio_venta})</div>`;
            });
            sug.innerHTML = html;
            sug.style.display = 'block';
        })
        .catch(err => console.error("Error en búsqueda:", err));
}

function seleccionarProductoBusqueda(codigo, nombre, precioVenta, precioCompra) {
    document.getElementById('sugerencias-busqueda').style.display = 'none';
    const cont = document.getElementById('contenedor-resultados-busqueda');
    if (cont) cont.style.display = 'block';

    document.getElementById('act-codigo-original').value = codigo;
    document.getElementById('act-codigo').value = codigo;
    document.getElementById('act-nombre').value = nombre;
    document.getElementById('act-precio').value = precioVenta;
    document.getElementById('act-compra').value = precioCompra;
}

async function actualizarProducto(e) {
    e.preventDefault();
    const codigoOriginal = document.getElementById('act-codigo-original').value;
    const nuevo_codigo = document.getElementById('act-codigo').value;
    const nombre = document.getElementById('act-nombre').value;
    const precio_venta = parseFloat(document.getElementById('act-precio').value);
    const precio_compra = parseFloat(document.getElementById('act-compra').value);

    try {
        const res = await fetch(`/api/productos/${codigoOriginal}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevo_codigo, nombre, precio_venta, precio_compra })
        });
        const data = await res.json();
        if (res.ok) {
            mostrarNotificacion(data.mensaje, "success");
            document.getElementById('contenedor-resultados-busqueda').style.display = 'none';
        } else {
            mostrarNotificacion(data.mensaje, "error");
        }
    } catch (err) {
        mostrarNotificacion("Error al actualizar.", "error");
    }
}

async function eliminarProducto(e) {
    e.preventDefault();
    const codigo = document.getElementById('del-codigo').value;
    if (!confirm(`¿Estás seguro de eliminar el producto con código / SKU ${codigo}?`)) return;

    try {
        const res = await fetch(`/api/productos/${codigo}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            mostrarNotificacion(data.mensaje, "success");
            e.target.reset();
        } else {
            mostrarNotificacion(data.mensaje, "error");
        }
    } catch (err) {
        mostrarNotificacion("Error al eliminar producto.", "error");
    }
}

// --- BLOQUE 10: Inventario y Reportes ---
function cambiarSubInventario(subseccion, boton) {
    document.querySelectorAll('#vista-inventario .sub-section').forEach(el => {
        el.classList.remove('active');
        el.style.display = 'none';
    });
    document.querySelectorAll('#vista-inventario .sub-btn').forEach(btn => btn.classList.remove('active'));

    const obj = document.getElementById(`sub-inv-${subseccion}`);
    if (obj) {
        obj.classList.add('active');
        obj.style.display = 'block';
    }
    if (boton) boton.classList.add('active');

    if (subseccion === 'productos') {
        cargarInventarioCompleto();
    }
}

let inventarioGlobalCache = [];

async function cargarInventarioCompleto() {
    try {
        const res = await fetch('/api/inventario');
        const data = await res.json();
        inventarioGlobalCache = data;
        
        let totalInvertido = 0;
        let totalExistencia = 0;

        data.forEach(item => {
            const costo = item.precio_costo || 0;
            const stock = item.stock || 0;
            totalInvertido += (costo * stock);
            totalExistencia += stock;
        });

        const elInvTotal = document.getElementById('inv-total-invertido');
        const elStockTotal = document.getElementById('inv-total-existencia');
        if (elInvTotal) elInvTotal.innerText = `$${totalInvertido.toFixed(2)}`;
        if (elStockTotal) elStockTotal.innerText = totalExistencia;

        popularFiltroDepartamentos(data);
        renderizarTablaInventario(data);
    } catch (error) {
        console.error("Error al cargar inventario completo:", error);
    }
}

function popularFiltroDepartamentos(data) {
    const select = document.getElementById('filtro-depto-inventario');
    if (!select) return;
    const deptos = [...new Set(data.map(item => item.departamento || 'Sin Departamento'))];
    
    let html = '<option value="">-- Todos los Departamentos --</option>';
    deptos.forEach(d => { html += `<option value="${d}">${d}</option>`; });
    select.innerHTML = html;
}

function filtrarInventarioPorDepartamento() {
    const deptoFiltro = document.getElementById('filtro-depto-inventario').value;
    if (!deptoFiltro) {
        renderizarTablaInventario(inventarioGlobalCache);
    } else {
        const filtrado = inventarioGlobalCache.filter(item => (item.departamento || 'Sin Departamento') === deptoFiltro);
        renderizarTablaInventario(filtrado);
    }
}

function renderizarTablaInventario(data) {
    const tbody = document.getElementById('tabla-inventario-completo');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay productos registrados en inventario.</td></tr>`;
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = () => seleccionarFilaInventario(tr, item);

        const imgThumbnail = item.imagen 
            ? `<img src="${item.imagen}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; vertical-align: middle; margin-right: 8px; background: #fff;" onmouseover="mostrarPreviewImg(event, '${item.imagen}')" onmouseout="ocultarPreviewImg()">` 
            : `<span style="font-size: 16px; margin-right: 8px;">📦</span>`;

        tr.innerHTML = `
            <td style="padding: 10px 12px; font-weight: 500; border-bottom: 1px solid var(--border-color);">${item.codigo_barras}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color);">${imgThumbnail} ${item.nombre}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: bold; color: #0284c7;">$${(item.precio_costo || 0).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: bold; color: var(--primary);">$${(item.precio_venta || 0).toFixed(2)}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); font-weight: bold; text-align: center; color: ${(item.stock || 0) <= (item.stock_minimo || 1) ? '#dc2626' : '#16a34a'};">${item.stock || 0}</td>
            <td style="padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: center; font-size: 12px; color: var(--text-muted);">${item.departamento || 'Sin Departamento'}</td>
        `;
        tbody.appendChild(tr);
    });
}

let productoInventarioSeleccionado = null;
function seleccionarFilaInventario(trElement, item) {
    document.querySelectorAll('#tabla-inventario-completo tr').forEach(tr => tr.style.background = 'transparent');
    trElement.style.background = 'var(--table-bg)';
    productoInventarioSeleccionado = item;
}

function mostrarPreviewImg(event, url) {
    let previewBox = document.getElementById('tooltip-img-preview');
    if (!previewBox) {
        previewBox = document.createElement('div');
        previewBox.id = 'tooltip-img-preview';
        previewBox.style.position = 'fixed';
        previewBox.style.zIndex = '99999';
        previewBox.style.background = 'white';
        previewBox.style.padding = '5px';
        previewBox.style.border = '1px solid #cbd5e1';
        previewBox.style.borderRadius = '8px';
        previewBox.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)';
        document.body.appendChild(previewBox);
    }
    previewBox.innerHTML = `<img src="${url}" style="width: 150px; height: 150px; object-fit: contain; border-radius: 4px; display: block;">`;
    previewBox.style.display = 'block';
    previewBox.style.left = (event.clientX + 15) + 'px';
    previewBox.style.top = (event.clientY + 15) + 'px';
}

function ocultarPreviewImg() {
    const previewBox = document.getElementById('tooltip-img-preview');
    if (previewBox) previewBox.style.display = 'none';
}

function irAModificarProductoSeleccionado() {
    if (!productoInventarioSeleccionado) {
        mostrarNotificacion("Por favor, seleccione un producto de la tabla para modificar.", "error");
        return;
    }
    cambiarVista('productos', document.querySelectorAll('.nav-btn')[1]);
    cambiarSubProducto('buscar-actualizar', document.querySelectorAll('.sub-btn')[1]);
    
    const inputBusqueda = document.getElementById('input-busqueda-producto');
    if (inputBusqueda) {
        inputBusqueda.value = productoInventarioSeleccionado.codigo_barras;
        ejecutarBusquedaAutomatica(productoInventarioSeleccionado.codigo_barras);
    }
}

function exportarInventarioCSV() {
    const deptoFiltro = document.getElementById('filtro-depto-inventario').value;
    const datosAExportar = deptoFiltro 
        ? inventarioGlobalCache.filter(item => (item.departamento || 'Sin Departamento') === deptoFiltro)
        : inventarioGlobalCache;

    if (datosAExportar.length === 0) {
        mostrarNotificacion("No hay datos para exportar.", "error");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,CodigoSKU,Producto,Costo,PrecioReferencia,Existencia,Departamento\n";
    datosAExportar.forEach(item => {
        csvContent += `"${item.codigo_barras}","${item.nombre.replace(/"/g, '""')}",${item.precio_costo || 0},${item.precio_venta},${item.stock},"${item.departamento || 'Sin Departamento'}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_${deptoFiltro ? deptoFiltro.toLowerCase().replace(/\s+/g, '_') : 'general'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarNotificacion("Archivo exportado con éxito.", "success");
}

function abrirOpcionesImpresion() {
    const deptoFiltro = document.getElementById('filtro-depto-inventario').value;
    const titulo = deptoFiltro ? `Reporte de Inventario - Departamento: ${deptoFiltro}` : `Reporte General de Inventario`;
    const datosAImprimir = deptoFiltro 
        ? inventarioGlobalCache.filter(item => (item.departamento || 'Sin Departamento') === deptoFiltro)
        : inventarioGlobalCache;

    let ventanaImpresion = window.open('', '_blank');
    let html = `
        <html>
        <head>
            <title>${titulo}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
                h2 { text-align: center; color: #4f46e5; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 13px; }
                th { background-color: #f1f5f9; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
            </style>
        </head>
        <body>
            <h2>${titulo}</h2>
            <p><strong>Fecha de emisión:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Código / SKU</th>
                        <th>Descripción</th>
                        <th class="text-right">Costo</th>
                        <th class="text-right">Precio Referencia</th>
                        <th class="text-center">Existencia</th>
                        <th>Departamento</th>
                    </tr>
                </thead>
                <tbody>
    `;

    let sumaCostoTotal = 0;
    datosAImprimir.forEach(item => {
        sumaCostoTotal += (item.precio_costo || 0) * (item.stock || 0);
        html += `
            <tr>
                <td>${item.codigo_barras}</td>
                <td>${item.nombre}</td>
                <td class="text-right">$${(item.precio_costo || 0).toFixed(2)}</td>
                <td class="text-right">$${(item.precio_venta || 0).toFixed(2)}</td>
                <td class="text-center">${item.stock || 0}</td>
                <td>${item.departamento || 'Sin Departamento'}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <h3 style="margin-top: 20px;">Inversión Total en Costo: $${sumaCostoTotal.toFixed(2)}</h3>
        </body>
        </html>
    `;

    ventanaImpresion.document.write(html);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    setTimeout(() => { ventanaImpresion.print(); }, 500);
}

// --- BLOQUE 11: Administración de Usuarios ---
async function cargarTablaUsuariosAdmin() {
    try {
        const res = await fetch('/api/usuarios');
        const usuarios = await res.json();
        const tbody = document.getElementById('tabla-usuarios-admin-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        if (usuarios.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No hay usuarios registrados.</td></tr>`;
            return;
        }

        usuarios.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${u.id}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color); font-weight: bold;">${u.usuario}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color);">${u.nombre_completo}</td>
                <td style="padding: 10px; border-bottom: 1px solid var(--border-color); text-align: center;">
                    <button onclick="abrirModalEditarUsuario(${u.id}, '${u.usuario}', '${u.nombre_completo}')" class="action-btn" style="background: #0284c7; padding: 5px 10px; font-size: 11px; margin-right: 5px;">✏️ Editar</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar usuarios admin:", error);
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

async function registrarNuevoUsuario(e) {
    e.preventDefault();
    const usuario = document.getElementById('nuevo-usu-user').value;
    const nombre_completo = document.getElementById('nuevo-usu-nombre').value;
    const password = document.getElementById('nuevo-usu-pass').value;

    try {
        const res = await fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, nombre_completo, password })
        });
        const data = await res.json();

        if (res.ok) {
            mostrarNotificacion("Usuario registrado correctamente.", "success");
            cerrarModalRegistro();
            cargarUsuariosLogin();
            cargarTablaUsuariosAdmin();
            document.getElementById('form-nuevo-usuario').reset();
        } else {
            mostrarNotificacion(data.mensaje || "No se pudo registrar el usuario.", "error");
        }
    } catch (err) {
        mostrarNotificacion("Error de conexión.", "error");
    }
}

function abrirModalEditarUsuario(id, usuario, nombre_completo) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-user').value = usuario;
    document.getElementById('edit-nombre').value = nombre_completo;
    document.getElementById('edit-pass').value = '';

    const modal = document.getElementById('modal-editar-usuario');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalEditar() {
    const modal = document.getElementById('modal-editar-usuario');
    if (modal) modal.style.display = 'none';
}

async function guardarEdicionUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const usuario = document.getElementById('edit-user').value;
    const nombre_completo = document.getElementById('edit-nombre').value;
    const password = document.getElementById('edit-pass').value;

    try {
        const res = await fetch(`/api/admin/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, nombre_completo, password })
        });

        if (res.ok) {
            mostrarNotificacion("Usuario actualizado con éxito.", "success");
            cerrarModalEditar();
            cargarTablaUsuariosAdmin();
            cargarUsuariosLogin();
        } else {
            mostrarNotificacion("Error al guardar cambios del usuario.", "error");
        }
    } catch (err) {
        mostrarNotificacion("Error de conexión al guardar cambios.", "error");
    }
}
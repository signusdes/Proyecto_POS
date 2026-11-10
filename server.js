// --- BLOQUE 1: Importaciones y Configuración Inicial ---
const express = require('express');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;

// Ampliamos el límite a 10MB para permitir la carga de imágenes en Base64
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static('public'));


// --- BLOQUE 2: Inicialización de la Base de Datos y Creación de Tablas ---
async function inicializarBD() {
    const SQL = await initSqlJs();
    let db;
    
    if (fs.existsSync('inventario.db')) {
        const filebuffer = fs.readFileSync('inventario.db');
        db = new SQL.Database(filebuffer);
    } else {
        db = new SQL.Database();
        db.run(`
            CREATE TABLE usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT UNIQUE,
                password TEXT,
                nombre_completo TEXT
            );

            CREATE TABLE departamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT UNIQUE
            );

            CREATE TABLE productos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_barras TEXT UNIQUE,
                nombre TEXT,
                precio_venta REAL,
                precio_compra REAL,
                precio_costo REAL DEFAULT 0,
                ganancia REAL DEFAULT 100,
                tipo_venta TEXT DEFAULT 'unidad',
                departamento TEXT DEFAULT 'Sin Departamento',
                stock_minimo INTEGER DEFAULT 1,
                imagen TEXT
            );

            CREATE TABLE lotes_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER,
                numero_lote TEXT,
                fecha_caducidad TEXT,
                stock_lote INTEGER,
                FOREIGN KEY(producto_id) REFERENCES productos(id)
            );

            CREATE TABLE ventas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total REAL
            );

            CREATE TABLE detalles_venta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                venta_id INTEGER,
                producto_id INTEGER,
                cantidad INTEGER,
                precio_unitario REAL,
                FOREIGN KEY(venta_id) REFERENCES ventas(id),
                FOREIGN KEY(producto_id) REFERENCES productos(id)
            );
        `);

        // Insertar usuario administrador por defecto
        db.run(`INSERT INTO usuarios (usuario, password, nombre_completo) VALUES ('admin', '1234', 'Administrador (Caja 1)');`);

        // Insertar departamentos por defecto
        const depsDefault = [
            'Sin Departamento',
            'ACCESORIOS P CELULAR',
            'ALIMENTOS Y BEBIDAS',
            'BEBÉ',
            'BELLEZA',
            'DULCERIA',
            'HIGIENE & CUIDADO',
            'HOGAR',
            'JUGUETERIA',
            'MASCOTAS',
            'PAPELERIA',
            'VEHICULOS',
            'VINOS Y LICORES'
        ];
        depsDefault.forEach(d => {
            db.run(`INSERT OR IGNORE INTO departamentos (nombre) VALUES ('${d}');`);
        });

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
    }
    return db;
}

// --- BLOQUE 3: Endpoint de Autenticación (Login) ---
app.post('/api/login', async (req, res) => {
    const { usuario, password } = req.body;

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(500).json({ mensaje: "Base de datos no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    const result = db.exec(`SELECT nombre_completo FROM usuarios WHERE usuario = '${usuario}' AND password = '${password}';`);

    if (result.length === 0 || result[0].values.length === 0) {
        return res.status(401).json({ mensaje: "Usuario o contraseña incorrectos." });
    }

    const nombreCompleto = result[0].values[0][0];
    res.json({ exito: true, mensaje: "Autenticación exitosa", usuario: nombreCompleto });
});


// --- BLOQUE 4: Endpoint para obtener la lista de usuarios (Selectores y Administración) ---
app.get('/api/usuarios', async (req, res) => {
    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.json([]);
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    let result = db.exec(`SELECT id, usuario, nombre_completo FROM usuarios;`);

    // Si la tabla está vacía, insertamos por seguridad al admin por defecto
    if (result.length === 0 || result[0].values.length === 0) {
        db.run(`INSERT OR IGNORE INTO usuarios (usuario, password, nombre_completo) VALUES ('admin', '1234', 'Administrador (Caja 1)');`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        result = db.exec(`SELECT id, usuario, nombre_completo FROM usuarios;`);
    }

    if (result.length === 0) return res.json([]);

    const columns = result[0].columns;
    const values = result[0].values;
    const usuarios = values.map(row => {
        let obj = {};
        columns.forEach((col, index) => { obj[col] = row[index]; });
        return obj;
    });

    res.json(usuarios);
});


// --- BLOQUE 5: Endpoint para registrar un nuevo usuario ---
app.post('/api/usuarios', async (req, res) => {
    const { usuario, password, nombre_completo } = req.body;

    if (!usuario || !password || !nombre_completo) {
        return res.status(400).json({ mensaje: "Todos los campos son obligatorios." });
    }

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(500).json({ mensaje: "BD no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        const countRes = db.exec(`SELECT COUNT(*) FROM usuarios;`);
        const totalUsuarios = countRes[0].values[0][0];

        if (totalUsuarios >= 11) {
            return res.status(400).json({ mensaje: "Límite alcanzado: solo se permiten hasta 10 usuarios nuevos además del administrador." });
        }

        db.run(`
            INSERT INTO usuarios (usuario, password, nombre_completo)
            VALUES ('${usuario}', '${password}', '${nombre_completo}');
        `);

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: `¡Usuario "${nombre_completo}" registrado con éxito!` });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al registrar el usuario (el nombre de usuario ya podría existir)." });
    }
});


// --- BLOQUE 6: Endpoints de Edición y Eliminación de Usuarios ---
app.put('/api/admin/usuarios/:id', async (req, res) => {
    const userId = req.params.id;
    const { usuario, password, nombre_completo } = req.body;

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(404).json({ mensaje: "BD no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        let updates = [];
        if (usuario) updates.push(`usuario = '${usuario}'`);
        if (nombre_completo) updates.push(`nombre_completo = '${nombre_completo}'`);
        if (password) updates.push(`password = '${password}'`);

        if (updates.length === 0) {
            return res.status(400).json({ mensaje: "No hay datos para actualizar." });
        }

        db.run(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ${userId};`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: "¡Usuario actualizado con éxito!" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar el usuario." });
    }
});

app.delete('/api/admin/usuarios/:id', async (req, res) => {
    const userId = req.params.id;

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(404).json({ mensaje: "BD no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        if (parseInt(userId) === 1) {
            return res.status(400).json({ mensaje: "No se puede eliminar al Administrador principal." });
        }

        db.run(`DELETE FROM usuarios WHERE id = ${userId};`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: "¡Usuario eliminado correctamente!" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al eliminar el usuario." });
    }
});


// --- BLOQUE 7: Endpoint para obtener el Inventario Completo ---
app.get('/api/inventario', async (req, res) => {
    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.json([]);
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    const result = db.exec(`
        SELECT p.id, p.codigo_barras, p.nombre, p.precio_costo, p.precio_venta, p.departamento, l.stock_lote as stock, p.stock_minimo, p.imagen
        FROM productos p
        JOIN lotes_inventario l ON p.id = l.producto_id
        ORDER BY p.nombre ASC;
    `);

    if (result.length === 0 || !result[0].values) return res.json([]);

    const columns = result[0].columns;
    const values = result[0].values;
    const inventario = values.map(row => {
        let obj = {};
        columns.forEach((col, index) => { obj[col] = row[index]; });
        return obj;
    });

    res.json(inventario);
});


// --- BLOQUE 8: Endpoints de Departamentos y Registro de Productos ---
app.get('/api/departamentos', async (req, res) => {
    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.json([]);
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    const result = db.exec(`SELECT id, nombre FROM departamentos ORDER BY nombre ASC;`);
    if (result.length === 0 || !result[0].values) return res.json([]);
    
    const columns = result[0].columns;
    const values = result[0].values;
    const deps = values.map(row => {
        let obj = {};
        columns.forEach((col, index) => { obj[col] = row[index]; });
        return obj;
    });
    res.json(deps);
});

app.post('/api/departamentos', async (req, res) => {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ mensaje: "El nombre del departamento es obligatorio." });
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    try {
        db.run(`INSERT INTO departamentos (nombre) VALUES ('${nombre.trim().toUpperCase()}');`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: "¡Departamento registrado con éxito!" });
    } catch (error) {
        res.status(500).json({ mensaje: "El departamento ya existe o hubo un error." });
    }
});

app.delete('/api/departamentos/:id', async (req, res) => {
    const depId = req.params.id;
    const SQL = await initSqlJs();
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    try {
        db.run(`DELETE FROM departamentos WHERE id = ${depId};`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: "¡Departamento eliminado correctamente!" });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al eliminar el departamento." });
    }
});

app.post('/api/productos', async (req, res) => {
    const { codigo_barras, nombre, precio_costo, ganancia, precio_venta, tipo_venta, departamento, stock_inicial, stock_minimo, imagen } = req.body;
    
    if (!codigo_barras || !nombre || precio_venta === undefined || stock_inicial === undefined) {
        return res.status(400).json({ mensaje: "Faltan campos obligatorios (Código, Nombre, Precio Venta y Stock Inicial)." });
    }

    if (stock_inicial < 0 || (stock_minimo !== undefined && stock_minimo < 0)) {
        return res.status(400).json({ mensaje: "El stock no puede ser negativo por ninguna circunstancia." });
    }

    try {
        const SQL = await initSqlJs();
        if (!fs.existsSync('inventario.db')) {
            return res.status(500).json({ mensaje: "Error: Base de datos no encontrada." });
        }

        const db = new SQL.Database(fs.readFileSync('inventario.db'));

        db.run(`
            INSERT INTO productos (codigo_barras, nombre, precio_venta, precio_compra, precio_costo, ganancia, tipo_venta, departamento, stock_minimo, imagen)
            VALUES ('${codigo_barras}', '${nombre}', ${precio_venta}, ${precio_costo || 0}, ${precio_costo || 0}, ${ganancia || 100}, '${tipo_venta || 'unidad'}', '${departamento || 'Sin Departamento'}', ${stock_minimo !== undefined ? stock_minimo : 1}, '${imagen || ''}');
        `);

        const prodRes = db.exec(`SELECT id FROM productos WHERE codigo_barras = '${codigo_barras}';`);
        if (prodRes.length === 0 || prodRes[0].values.length === 0) {
            return res.status(500).json({ mensaje: "Error al obtener el ID del producto registrado." });
        }
        const productoId = prodRes[0].values[0][0];

        db.run(`
            INSERT INTO lotes_inventario (producto_id, numero_lote, fecha_caducidad, stock_lote)
            VALUES (${productoId}, 'GENERAL', '2026-12-31', ${stock_inicial});
        `);

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: `¡Producto "${nombre}" registrado con éxito!` });
    } catch (error) {
        console.error("Error al registrar producto:", error);
        res.status(500).json({ mensaje: "Error al registrar el producto (el código de barras ya podría existir)." });
    }
});

app.post('/api/admin/generar-ficticios', async (req, res) => {
    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(500).json({ mensaje: "Base de datos no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    
    const departamentos = [
        'ACCESORIOS P CELULAR', 'ALIMENTOS Y BEBIDAS', 'BEBÉ', 'BELLEZA',
        'DULCERIA', 'HIGIENE & CUIDADO', 'HOGAR', 'JUGUETERIA',
        'MASCOTAS', 'PAPELERIA', 'VEHICULOS', 'VINOS Y LICORES'
    ];

    const nombresBase = [
        "Galletas de Chispas", "Refresco de Cola 600ml", "Jabón Corporal Neutro", "Shampoo Anti-caspa 400ml",
        "Pilas AA 4 Pack", "Cuaderno Profesional 100 Hojas", "Pluma Tinta Negra", "Chocolate Amargo 80g", 
        "Papas Fritas Saladas 150g", "Jugo de Naranja 1L", "Leche Entera 1L", "Cereal de Maíz 500g",
        "Aceite Vegetal 800ml", "Arroz Blanco 1kg", "Frijol Negro 1kg", "Pasta Espagueti 200g",
        "Atún en Agua 140g", "Limpiador Multi-usos 1L", "Suavizante de Telas 850ml", "Desodorante Spray 150ml",
        "Pasta Dental Triple Acción", "Papel Higiénico 4 Rollos", "Servilletas 200 Pzas", "Agua Embotellada 1.5L",
        "Cerveza Clara 355ml", "Vino Tinto Tinto 750ml", "Botana Mixta 200g", "Salsa Picante 250ml",
        "Café Soluble 100g", "Azúcar Estándar 1kg", "Sal con Yodo 1kg", "Galletas Rellenas 120g"
    ];

    const imagenesProductos = [
        "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=300",
        "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300",
        "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300",
        "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=300",
        "https://images.unsplash.com/photo-1553456558-aff63285bdd1?w=300"
    ];

    try {
        for (let i = 1; i <= 50; i++) {
            const codigo = `F${1000 + i}`;
            const nombreBase = nombresBase[Math.floor(Math.random() * nombresBase.length)];
            const nombre = `[F] ${nombreBase} ${i}`;
            const precioCosto = parseFloat((Math.random() * (120 - 10) + 10).toFixed(2));
            const ganancia = 100;
            const precioVenta = parseFloat((precioCosto + (precioCosto * (ganancia / 100))).toFixed(2));
            const dept = departamentos[Math.floor(Math.random() * departamentos.length)];
            const stockInicial = Math.floor(Math.random() * 85) + 15;
            const stockMinimo = Math.floor(Math.random() * 5) + 1;
            const imagenUrl = imagenesProductos[Math.floor(Math.random() * imagenesProductos.length)];

            db.run(`
                INSERT OR REPLACE INTO productos 
                (codigo_barras, nombre, precio_venta, precio_compra, precio_costo, ganancia, tipo_venta, departamento, stock_minimo, imagen)
                VALUES ('${codigo}', '${nombre}', ${precioVenta}, ${precioCosto}, ${precioCosto}, ${ganancia}, 'unidad', '${dept}', ${stockMinimo}, '${imagenUrl}');
            `);

            const prodRes = db.exec(`SELECT id FROM productos WHERE codigo_barras = '${codigo}';`);
            if (prodRes.length > 0 && prodRes[0].values.length > 0) {
                const productoId = prodRes[0].values[0][0];
                db.run(`DELETE FROM lotes_inventario WHERE producto_id = ${productoId};`);
                db.run(`
                    INSERT INTO lotes_inventario (producto_id, numero_lote, fecha_caducidad, stock_lote)
                    VALUES (${productoId}, 'LOTE-F-${i}', '2026-12-31', ${stockInicial});
                `);
            }
        }

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: "¡50 productos ficticios generados con éxito!" });
    } catch (error) {
        console.error("Error al generar ficticios:", error);
        res.status(500).json({ mensaje: "Error al generar productos ficticios." });
    }
});


// --- BLOQUE 9: Endpoints de Búsqueda y Actualización de Productos ---
app.get('/api/productos/buscar', async (req, res) => {
    const queryStr = req.query.q || '';

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.json([]);
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));
    
    // CORRECCIÓN: Se agrega p.imagen a la consulta SELECT para que viaje al frontend
    const result = db.exec(`
        SELECT p.id, p.codigo_barras, p.nombre, p.precio_venta, p.precio_costo, l.stock_lote as stock, p.imagen
        FROM productos p
        LEFT JOIN lotes_inventario l ON p.id = l.producto_id
        WHERE p.codigo_barras = '${queryStr}' OR p.codigo_barras LIKE '%${queryStr}%' OR p.nombre LIKE '%${queryStr}%';
    `);

    if (result.length === 0 || !result[0].values) return res.json([]);

    const columns = result[0].columns;
    const values = result[0].values;
    const productos = values.map(row => {
        let obj = {};
        columns.forEach((col, index) => { obj[col] = row[index]; });
        return obj;
    });

    res.json(productos);
});

app.put('/api/productos/:codigo', async (req, res) => {
    const codigoOriginal = req.params.codigo;
    const { nuevo_codigo, nombre, precio_venta, precio_compra } = req.body;

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(404).json({ mensaje: "BD no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        let updates = [];
        if (nuevo_codigo && nuevo_codigo !== codigoOriginal) {
            updates.push(`codigo_barras = '${nuevo_codigo}'`);
        }
        if (nombre) updates.push(`nombre = '${nombre}'`);
        if (precio_venta !== undefined) updates.push(`precio_venta = ${precio_venta}`);
        if (precio_compra !== undefined) updates.push(`precio_compra = ${precio_compra}`);

        if (updates.length === 0) return res.status(400).json({ mensaje: "No hay datos para actualizar." });

        db.run(`UPDATE productos SET ${updates.join(', ')} WHERE codigo_barras = '${codigoOriginal}';`);
        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: `¡Producto actualizado con éxito!` });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al actualizar el producto." });
    }
});


// --- BLOQUE 10: Endpoint para eliminar Productos ---
app.delete('/api/productos/:codigo', async (req, res) => {
    const codigoBarraUrl = req.params.codigo;

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(404).json({ mensaje: "BD no encontrada" });
    
    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        const prodRes = db.exec(`SELECT id FROM productos WHERE codigo_barras = '${codigoBarraUrl}';`);
        if (prodRes.length === 0 || prodRes[0].values.length === 0) {
            return res.status(404).json({ mensaje: "El producto no existe." });
        }
        const productoId = prodRes[0].values[0][0];

        db.run(`DELETE FROM lotes_inventario WHERE producto_id = ${productoId};`);
        db.run(`DELETE FROM productos WHERE id = ${productoId};`);

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ mensaje: `¡Producto ${codigoBarraUrl} eliminado correctamente!` });
    } catch (error) {
        res.status(500).json({ mensaje: "Error al eliminar el producto." });
    }
});


// --- BLOQUE 11: Endpoint Real de Procesamiento de Ventas ---
app.post('/api/vender', async (req, res) => {
    const { productos } = req.body; // Array de { id, cantidad, precio_venta }

    if (!productos || productos.length === 0) {
        return res.status(400).json({ mensaje: "No hay productos en el ticket." });
    }

    const SQL = await initSqlJs();
    if (!fs.existsSync('inventario.db')) return res.status(500).json({ mensaje: "BD no encontrada" });

    const db = new SQL.Database(fs.readFileSync('inventario.db'));

    try {
        let totalVenta = 0;
        productos.forEach(p => { totalVenta += (p.precio_venta * p.cantidad); });

        // 1. Insertar Venta Principal
        db.run(`INSERT INTO ventas (total) VALUES (${totalVenta.toFixed(2)});`);
        const ventaRes = db.exec(`SELECT MAX(id) FROM ventas;`);
        const ventaId = ventaRes[0].values[0][0];

        // 2. Insertar Detalles de Venta y Descontar Stock Real en Lotes
        for (const item of productos) {
            db.run(`
                INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario)
                VALUES (${ventaId}, ${item.id}, ${item.cantidad}, ${item.precio_venta});
            `);

            // Descontar del lote
            db.run(`
                UPDATE lotes_inventario 
                SET stock_lote = stock_lote - ${item.cantidad} 
                WHERE producto_id = ${item.id};
            `);
        }

        fs.writeFileSync('inventario.db', Buffer.from(db.export()));
        res.json({ exito: true, mensaje: `¡Venta #${ventaId} cobrada con éxito! Total: $${totalVenta.toFixed(2)}` });
    } catch (error) {
        console.error("Error al procesar la venta:", error);
        res.status(500).json({ mensaje: "Error al procesar el cobro de la venta." });
    }
});


// --- BLOQUE 12: Arranque del Servidor ---
inicializarBD().then(() => {
    app.listen(PORT, () => {
        console.log(`Servidor POS corriendo en http://localhost:${PORT}`);
    });
});
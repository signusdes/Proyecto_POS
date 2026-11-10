const initSqlJs = require('sql.js');
const fs = require('fs');

async function crearBaseDeDatos() {
    // Inicializamos SQL.js
    const SQL = await initSqlJs();
    
    console.log("⏳ Creando la base de datos y las tablas...");

    // Creamos una base de datos en memoria / archivo
    const db = new SQL.Database();

    // Ejecutamos el esquema SQL completo
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            rol TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS productos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_barras TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            precio_venta REAL NOT NULL,
            precio_compra REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lotes_inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            numero_lote TEXT NOT NULL,
            fecha_caducidad DATE NOT NULL,
            stock_lote INTEGER NOT NULL,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );

        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            total REAL NOT NULL,
            usuario_id INTEGER,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );

        CREATE TABLE IF NOT EXISTS detalles_venta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venta_id INTEGER NOT NULL,
            producto_id INTEGER NOT NULL,
            cantidad INTEGER NOT NULL,
            precio_unitario REAL NOT NULL,
            importe REAL NOT NULL,
            FOREIGN KEY (venta_id) REFERENCES ventas(id),
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );

        CREATE TABLE IF NOT EXISTS movimientos_inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            motivo TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (producto_id) REFERENCES productos(id)
        );
    `);

    // Guardamos la base de datos en un archivo físico 'inventario.db'
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync('inventario.db', buffer);

    console.log("¡Base de datos y tablas creadas y guardadas exitosamente como 'inventario.db'!");
}

crearBaseDeDatos();
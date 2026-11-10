const initSqlJs = require('sql.js');
const fs = require('fs');

async function insertarDatos() {
    const SQL = await initSqlJs();

    // Verificamos si ya existe el archivo de la base de datos para cargarlo
    let db;
    if (fs.existsSync('inventario.db')) {
        const filebuffer = fs.readFileSync('inventario.db');
        db = new SQL.Database(filebuffer);
    } else {
        db = new SQL.Database();
    }

    // 1. Insertamos un producto de prueba (ej. Leche Entera)
    console.log("⏳ Insertando producto...");
    db.run(`
        INSERT OR IGNORE INTO productos (codigo_barras, nombre, precio_venta, precio_compra)
        VALUES ('7501000123456', 'Leche Entera 1L', 25.50, 18.00);
    `);

    // 2. Insertamos un lote asociado a ese producto con fecha de caducidad
    console.log("⏳ Registrando lote y caducidad...");
    db.run(`
        INSERT INTO lotes_inventario (producto_id, numero_lote, fecha_caducidad, stock_lote)
        VALUES (
            (SELECT id FROM productos WHERE codigo_barras = '7501000123456'),
            'LOTE-A2026',
            '2026-12-31',
            50
        );
    `);

    // Guardamos los cambios en el archivo físico 'inventario.db'
    const data = db.export();
    fs.writeFileSync('inventario.db', Buffer.from(data));

    console.log("¡Producto y lote guardados exitosamente en la base de datos!");
}

insertarDatos();
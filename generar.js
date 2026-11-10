// --- Script para generar 50 productos ficticios con F ---
const fs = require('fs');
const initSqlJs = require('sql.js');

async function ejecutar() {
    const SQL = await initSqlJs();
    let db;

    if (fs.existsSync('inventario.db')) {
        const filebuffer = fs.readFileSync('inventario.db');
        db = new SQL.Database(filebuffer);
    } else {
        db = new SQL.Database();
    }

    // 1. Asegurar que las tablas existan antes de insertar
    db.run(`
        CREATE TABLE IF NOT EXISTS departamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE
        );

        CREATE TABLE IF NOT EXISTS productos (
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

        CREATE TABLE IF NOT EXISTS lotes_inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_id INTEGER,
            numero_lote TEXT,
            fecha_caducidad TEXT,
            stock_lote INTEGER,
            FOREIGN KEY(producto_id) REFERENCES productos(id)
        );
    `);

    const departamentos = [
        'ACCESORIOS P CELULAR', 'ALIMENTOS Y BEBIDAS', 'BEBÉ', 'BELLEZA',
        'DULCERIA', 'HIGIENE & CUIDADO', 'HOGAR', 'JUGUETERIA',
        'MASCOTAS', 'PAPELERIA', 'VEHICULOS', 'VINOS Y LICORES'
    ];

    for (let dep of departamentos) {
        db.run(`INSERT OR IGNORE INTO departamentos (nombre) VALUES ('${dep}');`);
    }

    const nombresBase = [
        "Galletas", "Refresco", "Jabón", "Shampoo", "Pilas", "Cuaderno", "Pluma", "Chocolate", 
        "Botana", "Jugo", "Leche", "Cereal", "Aceite", "Arroz", "Frijol", "Pasta", "Atún", 
        "Limpiador", "Suavizante", "Desodorante", "Pasta Dental", "Papel Higiénico", "Servilletas",
        "Agua Embotellada", "Cerveza", "Vino", "Chips", "Salsa", "Café", "Azúcar", "Sal"
    ];

    console.log("Generando 50 productos ficticios...");

    for (let i = 1; i <= 50; i++) {
        const codigo = `F${1000 + i}`;
        const nombreBase = nombresBase[Math.floor(Math.random() * nombresBase.length)];
        const nombre = `[F] ${nombreBase} Ficticio ${i}`;
        const costo = parseFloat((Math.random() * (150 - 5) + 5).toFixed(2));
        const ganancia = 100;
        const precioVenta = parseFloat((costo * 2).toFixed(2));
        const dept = departamentos[Math.floor(Math.random() * departamentos.length)];
        const stockInicial = Math.floor(Math.random() * 90) + 10;
        const stockMinimo = Math.floor(Math.random() * 8) + 2;

        db.run(`
            INSERT OR REPLACE INTO productos 
            (codigo_barras, nombre, precio_venta, precio_compra, precio_costo, ganancia, tipo_venta, departamento, stock_minimo, imagen)
            VALUES ('${codigo}', '${nombre}', ${precioVenta}, ${costo}, ${costo}, ${ganancia}, 'unidad', '${dept}', ${stockMinimo}, '');
        `);

        const prodRes = db.exec(`SELECT id FROM productos WHERE codigo_barras = '${codigo}';`);
        if (prodRes.length > 0 && prodRes[0].values.length > 0) {
            const productoId = prodRes[0].values[0][0];
            db.run(`
                INSERT INTO lotes_inventario (producto_id, numero_lote, fecha_caducidad, stock_lote)
                VALUES (${productoId}, 'LOTE-F-${i}', '2026-12-31', ${stockInicial});
            `);
        }
    }

    fs.writeFileSync('inventario.db', Buffer.from(db.export()));
    console.log("¡Listo! 50 productos ficticios guardados correctamente en inventario.db");
}

ejecutar();
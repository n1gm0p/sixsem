const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "tourism.db");
require("fs").mkdirSync(path.join(__dirname, "data"), { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function createDb() {
  return new sqlite3.Database(DB_PATH);
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

async function initializeDatabase() {
  const db = createDb();

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      card_gradient TEXT NOT NULL,
      hero_image TEXT,
      hero_title TEXT,
      what_to_see TEXT,
      tips TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  const columns = await all(db, "PRAGMA table_info(countries)");
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("hero_title")) {
    await run(db, "ALTER TABLE countries ADD COLUMN hero_title TEXT");
  }
  if (!columnNames.has("what_to_see")) {
    await run(db, "ALTER TABLE countries ADD COLUMN what_to_see TEXT");
  }
  if (!columnNames.has("tips")) {
    await run(db, "ALTER TABLE countries ADD COLUMN tips TEXT");
  }

  const existing = await all(db, "SELECT id FROM countries LIMIT 1");

  if (existing.length === 0) {
    const seedData = [
      ["Египет", "Пирамиды, Красное море", "Открой древнюю историю и теплый отдых у моря.", "linear-gradient(135deg, #7a4b2d, #c07a3f)", "/images/countries/egypt/hero.jpg", "Египет: земля фараонов", "[{\"title\":\"Пирамиды Гизы\",\"text\":\"Единственное из Семи чудес света, сохранившееся до наших дней.\",\"image\":\"/images/countries/egypt/giza.jpg\"},{\"title\":\"Луксорский храм\",\"text\":\"Грандиозный храмовый комплекс на берегу Нила.\",\"image\":\"/images/countries/egypt/luxor.jpg\"},{\"title\":\"Шарм-эль-Шейх\",\"text\":\"Курорт с лучшими местами для дайвинга и снорклинга.\",\"image\":\"/images/countries/egypt/sharm.jpg\"}]", "[\"Лучшее время для поездки - с октября по апрель.\",\"Торгуйтесь на рынках, цены для туристов часто завышены.\",\"Уважайте местные традиции и дресс-код у святынь.\"]"],
      ["Куба", "Гавана, ритмы, ретро", "Атмосфера старых улиц, музыка и Карибское солнце.", "linear-gradient(135deg, #8c4a24, #d69238)", "", "Куба: ритм Карибов", "[]", "[]"],
      ["Таиланд", "Пляжи, храмы, острова", "Экзотика, бирюзовая вода и насыщенная уличная кухня.", "linear-gradient(135deg, #007f8a, #3eb7b8)", "", "Таиланд: страна улыбок", "[]", "[]"],
      ["Китай", "Великая стена, мегаполисы", "Контраст древней культуры и современных технологий.", "linear-gradient(135deg, #334f38, #5f7f52)", "", "Китай: древность и будущее", "[]", "[]"],
      ["Франция", "Париж, Лазурный берег", "Искусство, гастрономия и романтичные маршруты.", "linear-gradient(135deg, #18374f, #2f6d8f)", "", "Франция: вкус жизни", "[]", "[]"],
      ["Филиппины", "Палаван, тропики", "Белоснежные пляжи и островные приключения круглый год.", "linear-gradient(135deg, #1f2f4e, #3d6ea2)", "", "Филиппины: островной рай", "[]", "[]"],
      ["Япония", "Токио, сакура, традиции", "Сочетание футуризма и многовековой эстетики.", "linear-gradient(135deg, #3f3f57, #7b6a83)", "", "Япония: гармония контрастов", "[]", "[]"],
      ["Италия", "Рим, Флоренция, Венеция", "История, живописные улочки и лучшие вкусы Европы.", "linear-gradient(135deg, #8d5a48, #b98764)", "", "Италия: искусство и dolce vita", "[]", "[]"],
      ["Исландия", "Водопады, ледники", "Северное сияние и маршруты по невероятной природе.", "linear-gradient(135deg, #5a6b7f, #9ab6c9)", "", "Исландия: дикая природа Севера", "[]", "[]"]
    ];

    for (const country of seedData) {
      await run(
        db,
        "INSERT INTO countries (name, subtitle, description, card_gradient, hero_image, hero_title, what_to_see, tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        country
      );
    }
  }

  db.close();
}

app.get("/api/countries", async (req, res) => {
  const db = createDb();
  try {
    const rows = await all(
      db,
      `SELECT id, name, subtitle, description, card_gradient AS cardGradient, hero_image AS heroImage
       FROM countries
       ORDER BY id`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Ошибка получения стран" });
  } finally {
    db.close();
  }
});

app.get("/api/countries/:id", async (req, res) => {
  const { id } = req.params;
  const db = createDb();
  try {
    const row = await get(
      db,
      `SELECT id, name, subtitle, description, card_gradient AS cardGradient, hero_image AS heroImage,
              COALESCE(hero_title, name) AS heroTitle, COALESCE(what_to_see, '[]') AS whatToSee,
              COALESCE(tips, '[]') AS tips
       FROM countries
       WHERE id = ?`,
      [id]
    );
    if (!row) {
      res.status(404).json({ message: "Страна не найдена" });
      return;
    }

    res.json({
      ...row,
      whatToSee: JSON.parse(row.whatToSee || "[]"),
      tips: JSON.parse(row.tips || "[]")
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка получения страны" });
  } finally {
    db.close();
  }
});

app.post("/api/countries", async (req, res) => {
  const { name, subtitle, description, cardGradient, heroImage, heroTitle, whatToSee, tips } = req.body;
  if (!name || !subtitle || !description || !cardGradient) {
    res.status(400).json({ message: "Заполните все поля" });
    return;
  }

  const db = createDb();
  try {
    const result = await run(
      db,
      "INSERT INTO countries (name, subtitle, description, card_gradient, hero_image, hero_title, what_to_see, tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        subtitle,
        description,
        cardGradient,
        heroImage || "",
        heroTitle || name,
        JSON.stringify(Array.isArray(whatToSee) ? whatToSee : []),
        JSON.stringify(Array.isArray(tips) ? tips : [])
      ]
    );

    res.status(201).json({
      id: result.lastID,
      name,
      subtitle,
      description,
      cardGradient,
      heroImage: heroImage || "",
      heroTitle: heroTitle || name,
      whatToSee: Array.isArray(whatToSee) ? whatToSee : [],
      tips: Array.isArray(tips) ? tips : []
    });
  } catch (error) {
    res.status(500).json({ message: "Не удалось добавить страну" });
  } finally {
    db.close();
  }
});

app.get("/country/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "country.html"));
});

initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Tourism app started: http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database initialization error:", error);
    process.exit(1);
  });

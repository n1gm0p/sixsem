const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "tourism.db");
require("fs").mkdirSync(path.join(__dirname, "data"), { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 14;

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

function verifyPassword(password, storedHash) {
  return String(password) === String(storedHash);
}

function parseBearerToken(headerValue) {
  if (!headerValue || !headerValue.startsWith("Bearer ")) {
    return null;
  }
  return headerValue.slice("Bearer ".length).trim();
}

async function getAuthUser(req) {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    return null;
  }

  const db = createDb();
  try {
    const session = await get(
      db,
      `SELECT s.user_id AS userId, s.expires_at AS expiresAt, u.id, u.email, u.display_name AS displayName
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
      [token]
    );
    if (!session) {
      return null;
    }
    if (Date.now() > Number(session.expiresAt)) {
      await run(db, "DELETE FROM sessions WHERE token = ?", [token]);
      return null;
    }
    return { id: session.id, email: session.email, displayName: session.displayName, token };
  } finally {
    db.close();
  }
}

async function initializeDatabase() {
  const db = createDb();
  await run(db, "PRAGMA foreign_keys = ON");

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

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL,
      country_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, country_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
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

app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    res.status(400).json({ message: "Заполните email, пароль и имя" });
    return;
  }
  if (String(password).length < 6) {
    res.status(400).json({ message: "Пароль должен быть минимум 6 символов" });
    return;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const db = createDb();
  try {
    const existing = await get(db, "SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing) {
      res.status(409).json({ message: "Пользователь с таким email уже существует" });
      return;
    }
    const result = await run(
      db,
      "INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)",
      [normalizedEmail, String(password), String(displayName).trim()]
    );
    res.status(201).json({ id: result.lastID, email: normalizedEmail, displayName: String(displayName).trim() });
  } catch (error) {
    res.status(500).json({ message: "Ошибка регистрации" });
  } finally {
    db.close();
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ message: "Введите email и пароль" });
    return;
  }

  const db = createDb();
  try {
    const user = await get(
      db,
      "SELECT id, email, password_hash AS passwordHash, display_name AS displayName FROM users WHERE email = ?",
      [String(email).trim().toLowerCase()]
    );
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ message: "Неверный email или пароль" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    await run(db, "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [token, user.id, expiresAt]);

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: user.displayName }
    });
  } catch (error) {
    res.status(500).json({ message: "Ошибка входа" });
  } finally {
    db.close();
  }
});

app.get("/api/auth/me", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется вход" });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
});

app.post("/api/auth/logout", async (req, res) => {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(200).json({ ok: true });
    return;
  }
  const db = createDb();
  try {
    await run(db, "DELETE FROM sessions WHERE token = ?", [token]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: "Ошибка выхода" });
  } finally {
    db.close();
  }
});

app.get("/api/favorites", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется вход" });
    return;
  }
  const db = createDb();
  try {
    const rows = await all(db, "SELECT country_id AS countryId FROM favorites WHERE user_id = ?", [user.id]);
    res.json({ favorites: rows.map((row) => row.countryId) });
  } catch (error) {
    res.status(500).json({ message: "Ошибка получения избранного" });
  } finally {
    db.close();
  }
});

app.post("/api/favorites/:countryId", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json({ message: "Требуется вход" });
    return;
  }
  const countryId = Number(req.params.countryId);
  if (!Number.isInteger(countryId) || countryId <= 0) {
    res.status(400).json({ message: "Некорректная страна" });
    return;
  }

  const db = createDb();
  try {
    const country = await get(db, "SELECT id FROM countries WHERE id = ?", [countryId]);
    if (!country) {
      res.status(404).json({ message: "Страна не найдена" });
      return;
    }
    const existing = await get(db, "SELECT 1 FROM favorites WHERE user_id = ? AND country_id = ?", [user.id, countryId]);
    if (existing) {
      await run(db, "DELETE FROM favorites WHERE user_id = ? AND country_id = ?", [user.id, countryId]);
      res.json({ isFavorite: false });
      return;
    }
    await run(db, "INSERT INTO favorites (user_id, country_id) VALUES (?, ?)", [user.id, countryId]);
    res.json({ isFavorite: true });
  } catch (error) {
    res.status(500).json({ message: "Ошибка обновления избранного" });
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

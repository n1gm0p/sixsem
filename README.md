# Tourism Project

Минимальный проект про туризм с backend на Express + SQLite и адаптивным frontend.

## Запуск

```bash
npm install
npm run dev
```

Откройте: `http://localhost:3000`

## API

- `GET /api/countries` — получить список стран
- `GET /api/countries/:id` — получить детальную информацию по стране
- `POST /api/countries` — добавить страну

Пример тела запроса:

```json
{
  "name": "Португалия",
  "subtitle": "Лиссабон, океан",
  "description": "Тёплый климат и красивые берега",
  "cardGradient": "linear-gradient(135deg, #2b5876, #4e4376)",
  "heroImage": "/images/countries/portugal/hero.jpg",
  "heroTitle": "Португалия: страна океана",
  "whatToSee": [
    {
      "title": "Башня Белен",
      "text": "Символ Лиссабона у реки Тежу",
      "image": "/images/countries/portugal/place-1.jpg"
    }
  ],
  "tips": [
    "Берите удобную обувь для прогулок по холмам.",
    "Лучшее время для поездки — весна и осень."
  ]
}
```

## Куда загружать фото

Все фотографии кладите в `public/images/countries/<slug>/`.

Пример:

- `public/images/countries/egypt/hero.jpg`
- `public/images/countries/egypt/giza.jpg`
- `public/images/countries/egypt/luxor.jpg`
- `public/images/countries/egypt/sharm.jpg`

После загрузки используйте эти пути в БД/API (например `"/images/countries/egypt/hero.jpg"`).

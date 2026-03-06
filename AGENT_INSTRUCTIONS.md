# Инструкции для импорта данных курса

## Пакет данных

Архив `data-package.zip` содержит:
- Видеоуроки (ссылки YouTube/Vimeo или локальные файлы)
- PDF презентации уроков
- Превью изображения для видео
- Практические материалы (видео + превью)

Файл добавлен в `.gitignore` и не попадает в репозиторий.

## Импорт

1. Поместите `data-package.zip` в корень проекта (если ещё не добавлен).

2. Распаковать архив в `server/migration_export`:
   ```bash
   # Windows (PowerShell)
   Expand-Archive -Path data-package.zip -DestinationPath server/migration_export -Force

   # Linux/macOS
   unzip -o data-package.zip -d server/migration_export
   ```

2. Выполнить импорт:
   ```bash
   cd server && npx tsx scripts/import-from-migration.ts migration_export
   ```

## Структура migration_export

Ожидаемая структура после распаковки:

```
migration_export/
├── manifest.json          # Обязательный: описание уроков и материалов
├── pdfs/                  # PDF файлы уроков (опционально)
├── previews/              # Превью изображения (опционально)
└── practical/            # Файлы практических материалов (опционально)
```

### manifest.json

```json
{
  "lessons": [
    {
      "lessonId": 1,
      "videoUrls": ["https://youtube.com/watch?v=...", "https://vimeo.com/..."],
      "pdfPaths": ["lesson-1-slides.pdf"],
      "previewPaths": ["lesson-1-v0.jpg", "lesson-1-v1.jpg"]
    }
  ],
  "practicalMaterials": [
    {
      "title": "Название",
      "description": "Описание",
      "videoUrl": "https://youtube.com/...",
      "previewPath": "material-1.jpg",
      "sortOrder": 0,
      "isPublished": true
    }
  ]
}
```

- `videoUrls` — массив ссылок (YouTube, Vimeo)
- `pdfPaths` — имена файлов из папки `pdfs/` или `migration_export/`
- `previewPaths` — имена файлов из папки `previews/` или `migration_export/`

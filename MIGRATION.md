# Миграция данных 21day-platform

## Импорт из data-package

**Основной способ** — пакет с видео, PDF, превью и практическими материалами:

1. Положите `data-package.zip` в корень проекта
2. Распакуйте: `Expand-Archive -Path data-package.zip -DestinationPath server/migration_export -Force` (Windows) или `unzip -o data-package.zip -d server/migration_export` (Linux/macOS)
3. `cd server && npx tsx scripts/import-from-migration.ts migration_export`

Подробности: **AGENT_INSTRUCTIONS.md**

## Импорт из JSON (без файлов)

Если есть только JSON с URL видео и путями к PDF:

```bash
cd server
npm run db:import-lessons -- path/to/export.json
```

**Формат:** `[ { "lesson_id": 1, "video_urls": [], "pdf_urls": [], ... } ]` или `{ "lessonContent": [ ... ] }`

## Файлы на сервере

После импорта: `server/uploads/` содержит PDF и превью. Скопируйте на сервер в `/var/www/21day-platform/server/uploads/` (scp/rsync).

-- The Chinese UI locale `zh` was renamed to `zh-CN` (labeled 简体中文) alongside
-- the new `zh-TW` (繁體中文) locale, aligning with tutor's zh-CN/zh-TW codes.
-- Rename existing translation + translator-assignment rows so they keep
-- resolving after the enum rename. Server-only tables (never synced); this is
-- a no-op on admin clients that hold no translator data.
UPDATE i18n_translations SET locale = 'zh-CN' WHERE locale = 'zh';
UPDATE translator_languages SET locale = 'zh-CN' WHERE locale = 'zh';

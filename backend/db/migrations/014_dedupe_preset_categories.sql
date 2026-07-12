-- 009のシードがON CONFLICT DO NOTHINGを謳っていたが、(name, parent_name)への
-- 一意制約が存在せず無効化されていたため、複数回の再実行で重複行が発生していた。
-- categoriesはpreset_categoriesを外部キー参照していないため、重複削除は安全。

DELETE FROM preset_categories a
USING preset_categories b
WHERE a.id > b.id
  AND a.name = b.name
  AND a.parent_name = b.parent_name;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preset_categories_name_parent_unique'
  ) THEN
    ALTER TABLE preset_categories
      ADD CONSTRAINT preset_categories_name_parent_unique UNIQUE (name, parent_name);
  END IF;
END $$;

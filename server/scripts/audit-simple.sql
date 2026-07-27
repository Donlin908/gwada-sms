-- Audit des numéros USA/CA en base de données
-- Liste tous les numéros avec détection heuristique du type

SELECT
  id,
  number,
  country,
  provider,
  "isAvailable",
  "usageCount",
  "createdAt",
  -- Détection heuristique type numéro
  CASE
    WHEN number LIKE '+1201%' OR number LIKE '+1203%' OR number LIKE '+1205%' THEN 'MOBILE'
    WHEN number LIKE '+1206%' OR number LIKE '+1209%' OR number LIKE '+1210%' THEN 'MOBILE'
    WHEN number LIKE '+1212%' OR number LIKE '+1213%' OR number LIKE '+1214%' THEN 'MOBILE'
    WHEN number LIKE '+1215%' OR number LIKE '+1216%' OR number LIKE '+1217%' THEN 'MOBILE'
    WHEN number LIKE '+1218%' OR number LIKE '+1219%' OR number LIKE '+1220%' THEN 'MOBILE'
    WHEN number LIKE '+1223%' OR number LIKE '+1224%' OR number LIKE '+1225%' THEN 'MOBILE'
    WHEN number LIKE '+1227%' OR number LIKE '+1228%' OR number LIKE '+1229%' THEN 'MOBILE'
    WHEN number LIKE '+1231%' OR number LIKE '+1234%' OR number LIKE '+1240%' THEN 'MOBILE'
    WHEN number LIKE '+1248%' OR number LIKE '+1251%' OR number LIKE '+1252%' THEN 'MOBILE'
    WHEN number LIKE '+1253%' OR number LIKE '+1254%' OR number LIKE '+1256%' THEN 'MOBILE'
    WHEN number LIKE '+1260%' OR number LIKE '+1262%' OR number LIKE '+1267%' THEN 'MOBILE'
    WHEN number LIKE '+1269%' OR number LIKE '+1270%' OR number LIKE '+1272%' THEN 'MOBILE'
    WHEN number LIKE '+1276%' OR number LIKE '+1281%' OR number LIKE '+1283%' THEN 'MOBILE'
    WHEN number LIKE '+1284%' OR number LIKE '+1301%' OR number LIKE '+1302%' THEN 'MOBILE'
    WHEN number LIKE '+1303%' OR number LIKE '+1304%' OR number LIKE '+1305%' THEN 'MOBILE'
    WHEN number LIKE '+1306%' OR number LIKE '+1307%' OR number LIKE '+1308%' THEN 'MOBILE'
    WHEN number LIKE '+1309%' OR number LIKE '+1310%' THEN 'MOBILE'
    -- Ajouter d'autres NPAs mobiles si besoin
    ELSE 'LOCAL/UNKNOWN'
  END as "estimatedType",
  CASE
    WHEN "isAvailable" = false THEN 'RÉSERVÉ (risque de rejet Klarna si LOCAL)'
    WHEN "isAvailable" = true THEN 'LIBRE'
  END as "status"
FROM phone_numbers
WHERE country IN ('us', 'ca')
ORDER BY country, "isAvailable" DESC, "createdAt" DESC;

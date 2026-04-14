export function normalizeEquipmentInput(input: {
  equipment: string;
  brand: string;
  model: string;
}) {
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const raw = `${input.equipment} ${input.brand} ${input.model}`;
  const text = normalizeText(raw);

  let result = {
    equipment: input.equipment || "",
    brand: input.brand || "",
    model: input.model || "",
  };

  // =========================
  // 🔥 DEEPSEA (DSE)
  // =========================
  if (/(deepsea|deepsia|dse)/.test(text)) {
    result.equipment = "Controlador";
    result.brand = "DeepSea";

    if (/(4510|4520)/.test(text)) {
      result.model = "4510/4520";
    }
  }

  // =========================
  // 🔥 CUMMINS / PCC
  // =========================
  if (/(cummins|pcc)/.test(text)) {
    result.equipment = "Controlador";
    result.brand = "Cummins";

    if (/1302/.test(text)) result.model = "PCC 1302";
    else if (/0500|500/.test(text)) result.model = "PCC 0500";
    else if (/2100/.test(text)) result.model = "PCC 2100";
  }

  // =========================
  // 🔥 SCANIA (MOTOR)
  // =========================
  if (/scania/.test(text)) {
    result.equipment = "Motor";
    result.brand = "Scania";

    if (/dc9/.test(text)) result.model = "DC9";
    if (/dc12/.test(text)) result.model = "DC12";
  }

  // =========================
  // 🔥 WEG (ALTERNADOR)
  // =========================
  if (/weg/.test(text)) {
    result.equipment = "Alternador";
    result.brand = "WEG";

    // tenta capturar modelo (ex: GTA, AG10, etc)
    const match = text.match(/\b(gta|ag\d+|w\d+)\b/);
    if (match) result.model = match[0].toUpperCase();
  }

  // =========================
  // 🔥 GENÉRICO (fallback)
  // =========================

  if (!result.equipment) {
    if (/gerador/.test(text)) result.equipment = "Gerador";
    else if (/compressor/.test(text)) result.equipment = "Compressor";
    else if (/torre/.test(text)) result.equipment = "Torre de Iluminação";
  }

  return result;
}
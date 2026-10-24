import { t } from '../i18n/index.js';
import { CASES } from './cases-list.js';
export { CASES };

export async function loadAllCases() {
  const entries = await Promise.all(
    CASES.map(async (caseDef) => {
      const response = await fetch(caseDef.file);
      if (!response.ok) {
        throw new Error(`${caseDef.file} ${t('MENU_CASE_LOAD_ERROR')}`);
      }
      const data = await response.json();
      return [caseDef.id, data.game_data];
    })
  );
  return Object.fromEntries(entries);
}

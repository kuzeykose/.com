export const EN = {
  // title / common
  APP_TITLE: 'THE OPERATOR',
  GAME_SUBTITLE: '[ POLYGRAPH INTERROGATION SIMULATOR ]',
  GAME_TAGLINE: 'YOU REVEAL THE TRUTH',
  PRESS_ANY_KEY: '>> PRESS ANY KEY TO START <<',
  LOADING: 'Loading...',
  LOAD_FAIL_TITLE: 'Game could not be started',

  // menu
  MENU_CASE_SELECT: '[ CASE SELECTION ]',
  MENU_CASE_LOAD_ERROR: 'Case could not be loaded.',
  MENU_KEY_INSTRUCTIONS: 'NUMBER KEYS: SELECT CASE',
  MENU_ENTER_START: '>> ENTER: START <<',
  STAT_NEW: 'NEW',
  STAT_SHORT_CORRECT: 'COR',
  STAT_SHORT_FAIL: 'FAIL',
  STAT_COMPLETED: 'COMPLETED',
  STAT_ATTEMPTED: 'ATTEMPTED',
  STAT_FAILED: 'FAILED',
  MENU_FULLSCREEN_HINT: 'F: Fullscreen',
  LANG_TOGGLE_HINT: 'L: TR',

  // dossier
  DOSSIER_TITLE: '[ DEFENDANT DOSSIER ]',
  DOSSIER_IDENTITY: 'IDENTITY',
  DOSSIER_NAME: 'Name',
  DOSSIER_ROLE: 'Role',
  DOSSIER_AGE: 'Age',
  DOSSIER_FAMILY: 'FAMILY & RELATIONS',
  DOSSIER_HEALTH: 'HEALTH STATUS',
  DOSSIER_POLY_TAG: 'POLYGRAPH',
  DOSSIER_HABITS: 'HABITS / MEDICATION',
  DOSSIER_PRIORS: 'PAST RECORDS',
  DOSSIER_PRESSURE: 'PRESSURE POINTS',
  DOSSIER_CASE_SUMMARY: 'CASE SUMMARY',
  DOSSIER_START_BTN: '>> START INTERROGATION (ENTER) <<',
  DOSSIER_FOOTER: 'ESC: Menu  |  Scroll: Scroll',
  DOSSIER_DEFAULT_NAME: 'DEFENDANT',
  PLAY_OPERATOR_LABEL: 'OPERATOR',

  // verdict
  VERDICT_TITLE: '[ VERDICT PHASE ]',
  VERDICT_SUSPECT_PREFIX: 'DEFENDANT: ',
  VERDICT_SUMMARY_HEADER: 'INTERROGATION SUMMARY',
  VERDICT_EVIDENCE_HEADER: 'POLYGRAPH EVIDENCE',
  VERDICT_HEART: 'HEART',
  VERDICT_STATS_FEAR: 'STRESS METER FINAL:',
  VERDICT_STATS_QUESTIONS: 'QUESTIONS:',
  VERDICT_STATS_STRESS: 'STRESS SCORE:',
  VERDICT_PROMPT: 'READ THE POLYGRAPH. ARE YOU CONVINCED THE DEFENDANT IS GUILTY?',
  VERDICT_GUILTY_BTN: '[1] GUILTY',
  VERDICT_GUILTY_SUB: 'Polygraph caught their lies',
  VERDICT_NOT_GUILTY_BTN: '[2] NOT GUILTY',
  VERDICT_NOT_GUILTY_SUB: 'Insufficient evidence',
  VERDICT_INSTRUCTIONS: '1 / 2 / MOUSE: GIVE VERDICT',
  VERDICT_CONFIRM_TITLE: 'ARE YOU SURE?',
  VERDICT_CONFIRM_BODY: 'This verdict will close the case.',
  VERDICT_CONFIRM_YES: 'CONFIRM',
  VERDICT_CONFIRM_NO: 'CANCEL',
  VERDICT_NO_RECORD: 'No interrogation record.',
  VERDICT_WAVE_HR: 'HR',
  VERDICT_WAVE_BREATHING: 'BR',
  VERDICT_WAVE_GSR: 'GS',
  VERDICT_WAVE_STRESS: 'ST',

  // bad end
  BAD_END_TITLE: '[ INTERROGATION FAILED ]',
  BAD_END_INSTRUCTIONS: 'ESC / ENTER / CLICK: Back to Menu',

  // result
  RESULT_CORRECT: '[ CORRECT VERDICT ]',
  RESULT_WRONG: '[ WRONG VERDICT ]',
  RESULT_YOUR_VERDICT: 'YOUR VERDICT:',
  RESULT_TRUE_VERDICT: 'TRUTH:',
  RESULT_TRUTH_STORY: 'THE TRUE STORY OF THE CASE',
  RESULT_INTERROGATION_RESULT: 'INTERROGATION RESULT',
  RESULT_INSTRUCTIONS: 'R: Replay  |  ESC: Menu',
  RESULT_ERROR: '[ ERROR ]',
  VERDICT_LABEL_GUILTY: 'GUILTY',
  VERDICT_LABEL_NOT_GUILTY: 'NOT GUILTY',

  // settings
  SETTINGS_TITLE: '[ SETTINGS ]',
  SETTINGS_LANGUAGE_LABEL: 'LANGUAGE',
  SETTINGS_SCROLL_LABEL: 'INVERT SCROLL',
  SETTINGS_SOUND_LABEL: 'SOUND',
  SETTINGS_CRT_LABEL: 'CRT EFFECT',
  SETTINGS_SCROLL_ON: 'ON',
  SETTINGS_SCROLL_OFF: 'OFF',
  SETTINGS_LANGUAGE_EN: 'ENGLISH',
  SETTINGS_LANGUAGE_TR: 'TURKCE',
  SETTINGS_BACK: 'ESC: Back to Menu',
  MENU_SETTINGS_HINT: 'S: Settings',
  MENU_BRIEFING_HINT: 'B: Briefing',

  // briefing
  BRIEFING_TITLE: '[ OPERATOR BRIEFING ]',
  BRIEFING_HINT_NEXT: 'ENTER / → : Next',
  BRIEFING_HINT_BACK: '← : Back',
  BRIEFING_HINT_STATE: 'SPACE : Next state',
  BRIEFING_HINT_EXIT: 'ESC : Menu',
  BRIEFING_SIM_LABEL: 'SIMULATION',
  BRIEFING_SIM_HINT: 'SPACE / CLICK',
  BRIEFING_INTRO_TITLE: 'READING THE ROOM',
  BRIEFING_INTRO_BODY:
    '- Read 5 sources together: PULSE, BREATHING, GSR, STRESS, and portrait cues.\n- No single channel is proof by itself.\n- After each question: observe change first, then verify with dossier notes.',
  BRIEFING_PULSE_TITLE: 'PULSE',
  BRIEFING_PULSE_BODY:
    '- On pulse, read beat density together with sudden spikes.\n- Hard questions usually create a rise.\n- If beta-blockers are noted, do not trust a flat pulse alone.',
  BRIEFING_BREATHING_TITLE: 'BREATHING',
  BRIEFING_BREATHING_BODY:
    '- Breathing gives rhythm: regular/deep suggests control.\n- Shallow/fast flow suggests defensive pressure.\n- Long flat segment + sharp inhale can indicate breath-holding.',
  BRIEFING_GSR_TITLE: 'GSR (SKIN CONDUCTANCE)',
  BRIEFING_GSR_BODY:
    '- GSR reaction is delayed relative to speech timing.\n- You often see the rise shortly after the question.\n- With caffeine/anxiety, timing is often more useful than raw peak height.',
  BRIEFING_FEAR_TITLE: 'STRESS METER',
  BRIEFING_FEAR_BODY:
    '- Stress is a pressure summary, not a standalone lie detector.\n- It rises on effective pressure, drops on weak/mistimed pressure.\n- High stress does not automatically mean guilty.',
  BRIEFING_CCTV_TITLE: 'DEFENDANT PORTRAIT',
  BRIEFING_CCTV_BODY:
    '- The portrait has no text labels, only visual cues.\n- Red/jitter: tension; collapse-like motion: breakdown; cold/still: control.\n- Always evaluate portrait cues with polygraph channels.',
  BRIEFING_CCTV_CUE_STONE_FACE: 'Controlled face',
  BRIEFING_CCTV_CUE_EYE_DART: 'Eyes darting',
  BRIEFING_CCTV_CUE_JAW_TIGHTEN: 'Jaw tightening',
  BRIEFING_CCTV_CUE_DEFENSIVE_CROSS_ARMS: 'Defensive posture',
  BRIEFING_CCTV_CUE_BREAKDOWN: 'Breaking down',
  BRIEFING_CCTV_CUE_TEAR_POOLING: 'Holding tears',
  BRIEFING_CCTV_CUE_RELIEVED_EXHALE: 'Relief exhale',
  BRIEFING_MODIFIERS_TITLE: 'MEDICAL & HABITS',
  BRIEFING_MODIFIERS_BODY:
    '- Medical and habit notes directly affect gameplay.\n- Do not skip "polygraph_effect" lines.\n- Rule of thumb: dossier first, chart second.',
  BRIEFING_CLOSE_TITLE: 'YOU ARE THE OPERATOR',
  BRIEFING_CLOSE_BODY:
    '- Safe flow: ask -> observe changes -> cross-check with dossier.\n- Re-read in log before final verdict.\n- Do not commit on a single signal.',

  // polygraph / UI
  POLY_HEADER: 'POLYGRAPH SIGNALS',
  POLY_FEAR: 'STRESS',
  POLY_PULSE: 'PULSE',
  POLY_BREATHING: 'BREATH',
  POLY_GSR: 'GSR',
  DIALOGUE_ANSWER_HEADER: '[ ANSWER ]',
  DIALOGUE_YOU_PREFIX: 'YOU: ',
  DIALOGUE_SKIP_HINT: 'Skip with ENTER',
  CHOICE_MODAL_TITLE: 'SELECT QUESTION',
  LOG_HEADER: '[ LOG ]',

  // pause menu
  PAUSE_TITLE: '[ PAUSED ]',
  PAUSE_CONTINUE: 'CONTINUE',
  PAUSE_SETTINGS: 'SETTINGS',
  PAUSE_QUIT: 'QUIT TO MENU',

  // tutorial
  TUTORIAL_NEXT: 'NEXT (ENTER / CLICK)',
  TUTORIAL_SKIP: 'ESC: SKIP',
  TUTORIAL_STEP: 'STEP',
  TUTORIAL_OF: '/',
  TUTORIAL_POLYGRAPH_TITLE: 'POLYGRAPH PANEL',
  TUTORIAL_POLYGRAPH_BODY:
    'Shows the suspect\u2019s pulse, brain and skin reactions. Colored bands during questions mark the intensity of their response.',
  TUTORIAL_DOSSIER_TITLE: 'DEFENDANT DOSSIER',
  TUTORIAL_DOSSIER_BODY:
    'Review medical notes, habits and pressure points. Some conditions can distort the polygraph readings.',
  TUTORIAL_LOG_TITLE: 'CONVERSATION LOG',
  TUTORIAL_LOG_BODY: 'Re-read everything that has been said during the interrogation here.',
  TUTORIAL_CHOICES_TITLE: 'QUESTIONS',
  TUTORIAL_CHOICES_BODY:
    'Click or press 1-9 to pick a question. Each one will provoke a different reaction.',

  // language / case filtering
  MENU_NO_CASES: 'NO CASES AVAILABLE FOR THIS LANGUAGE',
  WARN_LANG_MISMATCH: '! LANGUAGE CHANGED DURING CASE — CONTENT REMAINS IN ORIGINAL LANGUAGE',
};

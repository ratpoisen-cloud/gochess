export const BOARD_EMOJI_FILES = [
  'Emojis_48x48_108.png', 'Emojis_48x48_110.png', 'Emojis_48x48_130.png', 'Emojis_48x48_156.png',
  'Emojis_48x48_202.png', 'Emojis_48x48_232.png', 'Emojis_48x48_250.png', 'Emojis_48x48_261.png',
  'Emojis_48x48_267.png', 'Emojis_48x48_268.png', 'Emojis_48x48_273.png', 'Emojis_48x48_278.png',
  'Emojis_48x48_281.png', 'Emojis_48x48_282.png', 'Emojis_48x48_289.png', 'Emojis_48x48_326.png',
  'Emojis_48x48_334.png', 'Emojis_48x48_339.png', 'Emojis_48x48_340.png', 'Emojis_48x48_351.png',
  'Emojis_48x48_356.png', 'Emojis_48x48_357.png', 'Emojis_48x48_358.png', 'Emojis_48x48_360.png',
  'Emojis_48x48_361.png', 'Emojis_48x48_38.png', 'Emojis_48x48_64.png', 'Emojis_48x48_65.png',
  'Emojis_48x48_68.png', 'Emojis_48x48_69.png', 'Emojis_48x48_70.png', 'Emojis_48x48_71.png'
]

export const getEmojiUrl = (filename: string) => {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}emojis/board/${filename}`.replace(/\/+/g, '/')
}

/** Open-Meteo weather code → emoji + label. */
export const WEATHER_CODES: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️',  label: 'Clear sky' },     1:  { emoji: '🌤️', label: 'Mainly clear' },
  2: { emoji: '⛅',  label: 'Partly cloudy' }, 3:  { emoji: '☁️',  label: 'Overcast' },
  45:{ emoji: '🌫️', label: 'Foggy' },         48: { emoji: '🌫️', label: 'Icy fog' },
  51:{ emoji: '🌦️', label: 'Light drizzle' }, 53: { emoji: '🌦️', label: 'Drizzle' },
  55:{ emoji: '🌧️', label: 'Heavy drizzle' }, 61: { emoji: '🌧️', label: 'Light rain' },
  63:{ emoji: '🌧️', label: 'Rain' },          65: { emoji: '🌧️', label: 'Heavy rain' },
  71:{ emoji: '🌨️', label: 'Light snow' },    73: { emoji: '🌨️', label: 'Snow' },
  75:{ emoji: '❄️',  label: 'Heavy snow' },    80: { emoji: '🌦️', label: 'Showers' },
  82:{ emoji: '🌧️', label: 'Heavy showers' }, 85: { emoji: '🌨️', label: 'Snow showers' },
  95:{ emoji: '⛈️',  label: 'Thunderstorm' },
};

/** A small, curated list of broadly-useful English words.
 *  Used to seed the "top-5 words of the day" rotation.
 *  Five contiguous words are picked starting at (dayOfYear * 5) % WORDS.length. */
export const VOCAB_WORDS: string[] = [
  'serendipity','ephemeral','ubiquitous','pellucid','quintessential','luminous','ineffable','sonder','petrichor','halcyon',
  'limerence','susurrus','nemophilist','aurora','solitude','wanderlust','nefarious','vellichor','euphoria','clinquant',
  'mellifluous','ethereal','epitome','myriad','fastidious','ostensible','perennial','nuance','plethora','quixotic',
  'resilient','sagacious','tantamount','venerable','xenial','zealous','aplomb','beguile','cacophony','demure',
  'esoteric','furtive','garrulous','hubris','idyllic','juxtapose','kindle','laconic','meander','nascent',
  'obfuscate','panacea','quagmire','recalcitrant','salient','taciturn','umbrage','vicissitude','wistful','yearning',
  'zenith','abate','benevolent','cogent','diaphanous','elucidate','fervent','gregarious','harbinger','immutable',
  'jovial','kismet','languid','magnanimous','nostalgia','obsequious','perfunctory','quaff','redolent','sinuous',
  'tacit','undulate','vivacious','whimsical','xenophile','yonder','zephyr','assiduous','beatific','celestial',
  'didactic','effulgent','fecund','gossamer','hegemony','impetuous','jubilant','kaleidoscope','lithe','munificent',
  'nebulous','opulent','paradigm','quiescent','ravenous','solace','transcendent','unctuous','verdant','wraith',
  'absolution','beleaguer','candor','denouement','effervescent','frangible','gambol','histrionic','iconoclast','jejune',
  'kowtow','lachrymose','melancholy','noisome','obstreperous','penumbra','quotidian','rhapsody','sycophant','torpor',
  'ubiquity','vitriol','winsome','xenial','yare','zaftig','ablution','baleful','cerulean','dichotomy',
  'ebullient','flippant','grandiloquent','heliotrope','imbroglio','jocund','kerfuffle','lassitude','meretricious','noctambulist',
  'obviate','prodigal','quizzical','ruminate','sanguine','tenacious','umbra','vagary','wanton','xanthic',
  'yare','zealot','assuage','blandishment','contrite','desiccate','egress','fortuitous','glower','hagiography',
  'inveterate','juggernaut','kismet','levity','mendacious','natter','obfuscation','peripatetic','quibble','remonstrate',
  'salubrious','tendentious','unfettered','venial','wheedle','yclept','aberration','besmirch','convivial','disparage',
  'ennui','flagrant','gallivant','hapless','imperturbable','juxtaposition','knavery','licentious','mawkish','niggardly',
];

export interface WeatherInfo {
  temp: number; emoji: string; label: string;
  windSpeed: number; humidity: number;
  city: string; country: string;
  /** Optional 7-day forecast (loaded on demand). */
  daily?: Array<{
    date: string; max: number; min: number; emoji: string; label: string;
    sunrise?: string; sunset?: string;
  }>;
}

/**
 * @description Collection of footer messages for different contexts in the application
 *
 * Core Footers: for Pluto's usage and important information
 * General Footers: to appear in most embeds
 * Betting Footers: specifically during the process of betting, and some bet related embeds
 * Placed Bet Footers: for when a bet is successfully placed
 * High Bet Placed Footers: for when a high bet is successfully placed
 * Low Bet Placed Footers: for when a low bet is successfully placed
 */
const footers = {
	core: [
		'💲 Use /balance to check your profile',
		'👁️ Use /commands to see all commands',
		'❓ Learn more about Pluto via /help',
		'📞 Addicted? Call 1-800-GAMBLER',
		'🌟 Pluto: Not just a dwarf planet, but a stellar bot!',
	],
	general: [
		'🧙‍♂️ You shall not pass... up another bet! - Gandalf the Broke',
		'🚀 To infinity and beyond... goes your credit card bill!',
		'🕷️ With great bets comes great responsibility - Uncle Ben, probably',
		"🃏 Why so serious? Let's put a dent in that bank account!",
		"🏆 May the odds be ever in your favor... but they probably won't be.",
		'📞 Addicted? Call 1-800-GAMBLER',
		'🎲 Roll the dice! Your rent payment depends on it.',
		"🎭 It's not gambling, it's strategic investing... right?",
		'⏳ Chasing losses? The house loves that!',
		'🎰 Jackpot! Just kidding.',
		'🔥 Betting responsibly is for quitters.',
		'🤹‍♂️ Multitasking: Watching the game while losing money.',
		'💳 Your credit card just filed for emancipation.',
		'📉 This is fine *fire intensifies*.',
		'🎩 A magician never reveals their tricks... neither does the sportsbook.',
		'🐢 Slow and steady wins the race... but not the parlay.',
		"🏁 Betting is a marathon, not a sprint... unless you're out of money.",
	],
	betting: [
		"🎭 It's not gambling, it's strategic investing... right?",
		'🦄 Unicorns are real, and so are your chances of winning... maybe.',
		"🔮 Our crystal ball says you'll win... but it's been wrong before.",
		'🚀 To the moon! Or at least to the next payout.',
		'🦸‍♀️ You are guaranteed to win! (results may vary)',
		'💸 Risk it all! Your future self will understand.',
		'🎟️ One ticket to heartbreak, please!',
		'📊 99% analytics, 1% blind faith.',
		'🎙️ Live look at your bet: "I never had a chance."',
		'🏀 Brick after brick… and not just on the court.',
		"💵 Just one more bet, then I'll stop (probably).",
		"🎭 It's only a problem if you lose, right?",
		'⚡ Instant regret loading…',
		'🎠 Round and round we go, chasing losses forever.',
		'🤡 You thought this was a sure thing? Welcome to clown school.',
		'🎲 Roll the dice! Your rent payment depends on it.',
		'🏦 Your funds are on an adventure... to zero.',
	],
	placedBet: [
		'🧙‍♂️ Abracadabra! Your money has magically disappeared!',
		'🔒 Bet locked in! Now panic accordingly.',
		"📝 Submitted! We'll notify your financial advisor (just kidding).",
		'⏳ The bet is in, now begins the waiting game.',
		'💀 No turning back now!',
		'🎩 Hocus pocus! Your fate is now in the hands of strangers.',
		"🎬 And… action! Let's watch this disaster unfold.",
		'📅 Mark your calendar: Future disappointment incoming.',
		"🎲 Dice have been rolled. Good luck (you'll need it).",
		"🏁 Green light! Let's see where this bad decision takes us.",
		'🎼 Cue the suspense music!',
		'⚖️ Your bet is final. The sportsbook thanks you for your contribution.',
		'💥 Boom! Your bet is officially live.',
		'👀 Eyes on the prize... or on your dwindling funds.',
		'🔮 Prediction: This will be the one you regret the most.',
		'📜 Written in stone—your bet is now legend (or tragedy).',
		'📡 Signal sent! The universe now decides your fate.',
		'⚔️ The battle has begun. The odds are not in your favor.',
		"🎢 Strap in! It's going to be a wild ride.",
		'🧩 The bet is set. Now we wait for the pieces to fall… probably not in your favor.',
	],
	highBetPlaced: [
		"🐳 Whale alert! Oh wait, that's just your ambition.",
		'🚀 To the moon! Or at least to the next payout.',
		'💎 Diamonds are forever, but your bankroll might not be.',
		'🏦 Your bank account just felt a disturbance in the force.',
		'🦍 Ape strong! But your wallet might not be.',
		'💰 Big bets, big dreams, and even bigger regrets.',
		'🎰 High roller alert! Your future self is already crying.',
		'🔥 Go big or go home... or just go broke.',
		'🤑 Cha-ching! Or maybe just... ching.',
		'📉 The higher the bet, the harder the fall.',
	],
	lowBetPlaced: [
		'🐭 Small bets, big dreams... and tiny payouts.',
		'🍿 Popcorn bet! Small, crunchy, and forgettable.',
		"🪙 Pennies make dollars, but this bet won't.",
		'🌱 Planting seeds of hope... and disappointment.',
		'🦐 Shrimp bet! Tiny, but still risky.',
		'🍀 Luck of the Irish? More like luck of the broke.',
		'🎈 Light as a feather, but still a bad decision.',
		'🕊️ A gentle bet... for gentle losses.',
		'🍬 Sweet and small, but still a gamble.',
		'🧩 Tiny bet, tiny regret... or maybe not.',
	],
} as const;

type FooterTypes = keyof typeof footers | 'all';

async function randomFooter(type: FooterTypes = 'core'): Promise<string> {
	if (type === 'all') {
		const allFooters = Object.values(footers).flat();
		return allFooters[Math.floor(Math.random() * allFooters.length)];
	}

	const selectedFooters =
		type === 'core' ? footers.core : [...footers.core, ...footers[type]];

	return selectedFooters[Math.floor(Math.random() * selectedFooters.length)];
}

const supportMessage = 'Please reach out to `fenixforever` for support.';

export { randomFooter as helpfooter, supportMessage };

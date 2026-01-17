/**
 * Sports Service for EBC Hub
 * Fetches real-time football data from ESPN's public API
 * No API key required.
 */

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

const LEAGUES = {
    EPL: 'eng.1',
    LALIGA: 'esp.1',
    CHAMPIONS: 'uefa.champions',
    MLS: 'usa.1'
};

const CACHE_DURATION = 30 * 1000; // 30 seconds
const cache = new Map();

/**
 * Fetch live scores for a specific league
 * @param {string} leagueCode - e.g., 'eng.1'
 */
async function fetchLiveScores(leagueCode = LEAGUES.EPL) {
    const cacheKey = `scores_${leagueCode}`;
    const cached = cache.get(cacheKey);

    // Return cached data if valid
    if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
        return cached.data;
    }

    try {
        const response = await fetch(`${ESPN_BASE_URL}/${leagueCode}/scoreboard`);
        if (!response.ok) throw new Error('Network response was not ok');

        const data = await response.json();

        // Parse into a clean format for our UI
        const matches = data.events.map(event => {
            const competition = event.competitions[0];
            const home = competition.competitors.find(c => c.homeAway === 'home');
            const away = competition.competitors.find(c => c.homeAway === 'away');

            return {
                id: event.id,
                date: event.date,
                shortName: event.shortName,
                status: event.status.type.state, // 'pre', 'in', 'post'
                clock: event.status.displayClock,
                period: event.status.period,
                isLive: event.status.type.state === 'in',
                league: data.leagues[0].abbreviation,
                homeTeam: {
                    name: home.team.abbreviation || home.team.shortDisplayName,
                    logo: home.team.logo,
                    score: home.score || '0',
                    color: home.team.color
                },
                awayTeam: {
                    name: away.team.abbreviation || away.team.shortDisplayName,
                    logo: away.team.logo,
                    score: away.score || '0',
                    color: away.team.color
                }
            };
        });

        // Cache the result
        cache.set(cacheKey, {
            timestamp: Date.now(),
            data: matches
        });

        return matches;
    } catch (error) {
        console.error('Error fetching sports data:', error);
        return [];
    }
}

/**
 * Get formatting status text
 */
function getMatchStatus(match) {
    if (match.status === 'pre') {
        const date = new Date(match.date);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (match.status === 'in') {
        return `<span class="live-pulse"></span> ${match.clock}'`;
    }
    if (match.status === 'post') {
        return 'FT';
    }
    return match.status;
}

export { fetchLiveScores, getMatchStatus, LEAGUES };

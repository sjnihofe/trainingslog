// Simulierter Strava-Server für lokale Tests: node scripts/strava-mock.mjs (Port 4000)
import http from 'http';
const acts = [
  { id: 9000000001, name: 'Testlauf kurz', sport_type: 'Run', start_date: '2030-01-02T06:00:00Z', start_date_local: '2030-01-02T07:00:00Z', distance: 5000, moving_time: 1500, elapsed_time: 1600, total_elevation_gain: 12, average_heartrate: 150 },
  { id: 9000000002, name: 'Testlauf lang', sport_type: 'TrailRun', start_date: '2030-01-03T06:00:00Z', start_date_local: '2030-01-03T07:00:00Z', distance: 10000, moving_time: 3300, elapsed_time: 3400 },
  { id: 9000000003, name: 'Radfahrt (darf nicht erscheinen)', sport_type: 'Ride', start_date: '2030-01-02T10:00:00Z', start_date_local: '2030-01-02T11:00:00Z', distance: 30000, moving_time: 3600 },
];
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost:4000');
  const send = (code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.pathname === '/oauth/authorize') {
    const back = new URL(u.searchParams.get('redirect_uri'));
    back.searchParams.set('state', u.searchParams.get('state'));
    back.searchParams.set('code', 'testcode');
    back.searchParams.set('scope', 'read,activity:read_all');
    res.writeHead(302, { Location: back.toString() }); return res.end();
  }
  if (u.pathname === '/oauth/token') return send(200, { access_token: 'tok-ok', refresh_token: 'ref-ok', expires_at: Math.floor(Date.now() / 1000) + 21600, athlete: { id: 42, firstname: 'Test', lastname: 'Läufer' } });
  if (u.pathname === '/oauth/deauthorize') return send(200, {});
  if (u.pathname === '/api/v3/athlete/activities') {
    if (req.headers.authorization !== 'Bearer tok-ok') return send(401, { message: 'Authorization Error' });
    return send(200, u.searchParams.get('page') === '1' ? acts : []);
  }
  send(404, {});
}).listen(4000, () => console.log('strava-mock :4000'));

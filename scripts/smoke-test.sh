# API-Smoke-Test: DATABASE_URL, SESSION_SECRET und PW (App-Passwort) als Env setzen, nach "next build" ausführen.
set -e
cd "$(dirname "$0")/.."
(PORT=3000 npx next start -p 3000 > /tmp/srv.log 2>&1 &) ; sleep 6
B=http://localhost:3000; J='-H Content-Type:application/json'; C='-b /tmp/c -c /tmp/c'
echo "== unauth api:"; curl -s $B/api/exercises | head -c 80; echo
echo "== unauth page:"; curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/verlauf
echo "== wrong pw:"; curl -s $J -d '{"password":"x"}' $B/api/auth/login; echo
echo "== login:"; curl -s $C $J -d "{\"password\":\"$PW\"}" -X POST $B/api/auth/login; echo
echo "== status:"; curl -s $B/api/auth/status; echo
echo "== root redirect:"; curl -s $C -o /dev/null -w '%{http_code} %{redirect_url}\n' $B/
echo "== day 2026-10-10:"; curl -s $C $B/api/day/2026-10-10 | head -c 400; echo
echo "== exercises count:"; curl -s $C $B/api/exercises | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);console.log(a.length, a.slice(0,3).map(x=>x.name+":"+x.uses+":"+x.last_date).join(" | "))})'
echo "== history Kniebeuge before 2026-10-11:"; curl -s $C "$B/api/exercises/1/history?before=2026-10-11&limit=2"; echo
echo "== create exercise:"; EX=$(curl -s $C $J -d '{"name":"Test Übung","category":"Sonstiges"}' $B/api/exercises); echo $EX
EID=$(echo $EX | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).id))')
echo "== create entry:"; EN=$(curl -s $C $J -d "{\"date\":\"2030-01-01\",\"exerciseId\":$EID,\"sets\":[{\"reps\":8,\"weight\":\"22,5\",\"bodyweight\":false},{\"reps\":7,\"weight\":20,\"bodyweight\":false}]}" $B/api/entries); echo $EN
ENID=$(echo $EN | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).id))')
echo "== update entry:"; curl -s $C $J -X PUT -d '{"sets":[{"reps":10,"weight":null,"bodyweight":true}]}' $B/api/entries/$ENID; echo
echo "== day 2030:"; curl -s $C $B/api/day/2030-01-01; echo
echo "== note:"; curl -s $C $J -X PUT -d '{"note":"Testnotiz"}' $B/api/day/2030-01-01; echo
echo "== delete entry:"; curl -s $C -X DELETE $B/api/entries/$ENID; echo
echo "== day after delete:"; curl -s $C $B/api/day/2030-01-01; echo
echo "== clear note:"; curl -s $C $J -X PUT -d '{"note":""}' $B/api/day/2030-01-01; echo
echo "== rename+archive:"; curl -s $C $J -X PATCH -d '{"name":"Kniebeuge"}' $B/api/exercises/$EID; echo
echo "== workouts:"; curl -s $C $B/api/workouts | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);console.log(a.length, JSON.stringify(a[0]).slice(0,200), a.find(w=>w.note)?.date)})'
echo "== export head:"; curl -s $C $B/api/export | head -3
echo "== passkey reg options:"; curl -s $C $B/api/auth/passkey/register-options | head -c 200; echo
echo "== pages:"; for p in / /tag/2026-10-10 /verlauf /fortschritt /fortschritt/1 /mehr /login /manifest.webmanifest /icon.png; do curl -s $C -o /dev/null -w "$p %{http_code}\n" $B$p; done
echo "== server log errors:"; grep -i error /tmp/srv.log | head
echo "TESTEXID=$EID"

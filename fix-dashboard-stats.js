const fs = require('fs');
let content = fs.readFileSync('artifacts/testbook-web/src/pages/dashboard.tsx', 'utf8');

content = content.replace(
  'const tgAuth = typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData;',
  `const tgAuth = typeof window !== "undefined" && (window as any).Telegram?.WebApp?.initData;
  const [profile, setProfile] = useState<any>(null);
  
  useEffect(() => {
    if (token) {
      fetch(\`/api/learner/profile?token=\${token}\`)
        .then(r => r.ok ? r.json() : null)
        .then(data => setProfile(data))
        .catch(console.error);
    }
  }, [token]);`
);

content = content.replace(
  '<h1 className="text-3xl font-bold tracking-tight text-[#17333d]">Welcome back, Learner</h1>',
  '<h1 className="text-3xl font-bold tracking-tight text-[#17333d]">Welcome back, {profile?.fullName?.split(" ")[0] || "Learner"}</h1>'
);

content = content.replace(
  '<CardTitle className="text-4xl font-bold text-[#17333d]">12</CardTitle>',
  '<CardTitle className="text-4xl font-bold text-[#17333d]">{profile?.testsTaken ?? 0}</CardTitle>'
);

content = content.replace(
  '<CardTitle className="text-4xl font-bold text-[#17333d]">76%</CardTitle>',
  '<CardTitle className="text-4xl font-bold text-[#17333d]">--</CardTitle>'
);

content = content.replace(
  '<CardTitle className="text-4xl font-bold text-[#17333d]">450</CardTitle>',
  '<CardTitle className="text-4xl font-bold text-[#17333d]">{profile?.coins ?? 0}</CardTitle>'
);

fs.writeFileSync('artifacts/testbook-web/src/pages/dashboard.tsx', content);

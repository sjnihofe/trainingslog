'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconChart, IconDumbbell, IconList, IconMore } from './Icons';

const items = [
  { href: '/', match: '/tag', label: 'Training', Icon: IconDumbbell },
  { href: '/verlauf', match: '/verlauf', label: 'Verlauf', Icon: IconList },
  { href: '/fortschritt', match: '/fortschritt', label: 'Fortschritt', Icon: IconChart },
  { href: '/mehr', match: '/mehr', label: 'Mehr', Icon: IconMore },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="nav-inner">
        {items.map(({ href, match, label, Icon }) => (
          <Link key={href} href={href} className={path.startsWith(match) ? 'active' : ''}>
            <Icon />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import { useInstantSearch } from 'react-instantsearch';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthState } from './auth-state';
import { ROUTES } from './routes';
import { supabase } from './supabase';

export function Footer() {
  return (
    <footer
      style={{ textAlign: 'justify', maxWidth: '60ch', margin: '0 auto' }}
    >
      <p>
        Made with 🚲 by <a href="https://haroen.me">Haroen Viaene</a>. Data
        sources:{' '}
        <a href="https://www.audax-club-parisien.com/organisation/brm-monde/#calendrier-BRM">
          ACP
        </a>
        , <a href="https://map.audax-club-parisien.com">ACP</a>,{' '}
        <a href="https://www.randonneursmondiaux.org/59-Calendrier.html">LRM</a>
        , <a href="http://rusa.org">RUSA</a>,{' '}
        <a href="https://audax.uk">Audax UK</a>,{' '}
        <a href="https://www.audaxitalia.it">Audax Italia</a>,{' '}
        <a href="https://www.audaxireland.org">Audax Ireland</a>,{' '}
        <a href="https://randonneurs.be">Randonneurs BE</a>,{' '}
        <a href="https://www.randonneurs.nl">Randonneurs NL</a>. Code available
        on <a href="https://github.com/haroenv/brm-search">GitHub</a>.
      </p>
      <p>
        A Brevet is a long-distance cycling event with as goal to move your own
        boundaries, not a race. They are classified in different distances, with
        as eventual goal the{' '}
        <a href="https://www.paris-brest-paris.org">
          Paris-Brest-Paris Randonneur
        </a>{' '}
        (1200km) event which is organised every four years. Every event has a
        time limit, and you need to finish within that time limit to get a
        validation, although usually this is fairly generous.
      </p>
      <p>
        I invite you happily to find an event to participate in on this site,
        which is frequently updated with information from different sources (let
        me know if I'm missing any). Have a nice ride!
      </p>
    </footer>
  );
}

export function Logo({ resets = true }: { resets?: boolean }) {
  const { setIndexUiState } = useInstantSearch();
  return (
    <Link
      to={ROUTES.home}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || !resets) return;
        e.preventDefault();
        setIndexUiState({});
      }}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <h1
        style={{
          fontSize: 'inherit',
          fontVariant: 'all-small-caps',
          color:
            'rgba(var(--ais-primary-color-rgb),var(--ais-primary-color-alpha, 1))',
        }}
      >
        Brevet Finder
      </h1>
    </Link>
  );
}

export function TopBar({ resets = true }: { resets?: boolean }) {
  return (
    <div className="top-bar">
      <Logo resets={resets} />
      <AccountLinks />
    </div>
  );
}

export function AccountLinks() {
  const { user, loading, configured } = useAuthState();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (loading || !configured) {
    return null;
  }

  const supabaseClient = supabase;
  if (!supabaseClient) {
    return null;
  }

  return (
    <nav aria-label="account" className="account-nav">
      {user ? (
        <>
          <Link className="account-nav__item" to={ROUTES.account}>
            account
          </Link>
          <button
            type="button"
            className="account-nav__item"
            disabled={isSigningOut}
            onClick={async () => {
              setIsSigningOut(true);
              await supabaseClient.auth.signOut();
              setIsSigningOut(false);
            }}
          >
            {isSigningOut ? '…' : 'sign out'}
          </button>
        </>
      ) : (
        <>
          <Link className="account-nav__item" to={ROUTES.login}>
            log in
          </Link>
          <Link className="account-nav__item" to={ROUTES.signup}>
            sign up
          </Link>
        </>
      )}
    </nav>
  );
}

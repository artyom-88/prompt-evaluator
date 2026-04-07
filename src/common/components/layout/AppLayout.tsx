import { Link, Outlet } from 'react-router-dom';

export function AppLayout() {
  return (
    <div className='min-h-screen bg-stone-100 text-stone-900'>
      <header className='border-b border-stone-200 bg-white'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <Link to='/' className='text-lg font-semibold tracking-tight'>
            Prompt Evaluator
          </Link>
          <nav className='flex gap-3 text-sm text-stone-600'>
            <Link className='hover:text-stone-950' to='/scenarios'>
              Scenarios
            </Link>
            <Link className='hover:text-stone-950' to='/scenarios/new'>
              New scenario
            </Link>
          </nav>
        </div>
      </header>
      <main className='mx-auto max-w-7xl px-6 py-8'>
        <Outlet />
      </main>
    </div>
  );
}

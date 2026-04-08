import { Component, type ReactElement, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { Card, CardContent, CardHeader } from '@/common/components/ui/Card';

interface RouteErrorBoundaryProps {
  children: ReactNode;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundaryInner extends Component<RouteErrorBoundaryProps & { locationKey: string }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidUpdate(previousProps: Readonly<RouteErrorBoundaryProps & { locationKey: string }>): void {
    if (previousProps.locationKey !== this.props.locationKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Card>
          <CardHeader>
            <h1 className='text-xl font-semibold'>Something went wrong on this page.</h1>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-sm text-stone-600'>
              The app recovered safely, but this route failed to render. Go back to the scenarios list and try the action again.
            </p>
            <Link
              className='inline-flex rounded-md bg-stone-950 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800'
              to='/scenarios'
            >
              Back to scenarios
            </Link>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export const RouteErrorBoundary = ({ children }: RouteErrorBoundaryProps): ReactElement => {
  const location = useLocation();

  return <RouteErrorBoundaryInner locationKey={location.pathname}>{children}</RouteErrorBoundaryInner>;
};

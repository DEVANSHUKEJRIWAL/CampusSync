import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import EventDashboard from './EventDashboard';
import { ToastProvider } from '../context/ToastContext';

// 1. Mock Auth0
vi.mock('@auth0/auth0-react', () => ({
    useAuth0: () => ({
        getAccessTokenSilently: vi.fn().mockResolvedValue('mock_token'),
        isAuthenticated: true,
        user: { email: 'test@example.com' }
    }),
}));

// 2. Mock Global Fetch
globalThis.fetch = vi.fn();

// 3. Mock Calendar Component
vi.mock('./CalendarView', () => ({
    default: () => <div data-testid="calendar-view">Mock Calendar View</div>
}));

function renderWithProviders(ui: React.ReactElement) {
    return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('EventDashboard Component', () => {
    const mockEvent = {
        id: 1,
        title: 'Interaction Test Event',
        description: 'Testing clicks',
        location: 'Virtual',
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        capacity: 100,
        status: 'UPCOMING',
        visibility: 'PUBLIC'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // Default: Return list of events for generic calls
        (globalThis.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => [mockEvent],
        });
    });

    it('renders the dashboard header', () => {
        renderWithProviders(<EventDashboard />);
        expect(screen.getByText(/Event Dashboard/i)).toBeInTheDocument();
    });

    it('fetches and displays events', async () => {
        renderWithProviders(<EventDashboard />);

        await waitFor(() => {
            // Use getAllByText to avoid errors if text appears multiple times
            const elements = screen.getAllByText('Interaction Test Event');
            expect(elements.length).toBeGreaterThan(0);
        });
    });

    it('allows user to register for an event', async () => {
        renderWithProviders(<EventDashboard />);

        // 1. Wait for button to appear
        const joinBtn = await screen.findByRole('button', { name: /Join/i });

        // 2. Mock the API Responses accurately
        (globalThis.fetch as any).mockImplementation((url: string) => {
            // Only return the success object if it's the registration POST
            if (url.includes('event_id=')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({ status: 'REGISTERED' }),
                });
            }
            // For everything else (like refreshing the list or my schedule), return an array
            return Promise.resolve({
                ok: true,
                json: async () => []
            });
        });

        // 3. Click it!
        fireEvent.click(joinBtn);

        // 4. Check if Success Message appears (Toast)
        await waitFor(() => {
            expect(screen.getByText(/Success! You are registered/i)).toBeInTheDocument();
        });
    });

    it('switches to calendar view', async () => {
        renderWithProviders(<EventDashboard />);

        // 1. Find and Click "Calendar" Toggle
        const calBtn = screen.getByRole('button', { name: 'Calendar' });
        fireEvent.click(calBtn);

        // 2. Check if Calendar Component is visible (via our Mock)
        await waitFor(() => {
            expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
        });
    });
});
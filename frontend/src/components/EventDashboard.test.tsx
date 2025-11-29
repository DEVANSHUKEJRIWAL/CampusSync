import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, waitFor, fireEvent} from '@testing-library/react';
import React from 'react';
import EventDashboard from './EventDashboard';
import {ToastProvider} from '../context/ToastContext';

vi.mock('@auth0/auth0-react', () => ({
    useAuth0: () => ({
        getAccessTokenSilently: vi.fn().mockResolvedValue('mock_token'),
        isAuthenticated: true,
        user: {email: 'test@example.com'}
    }),
}));

globalThis.fetch = vi.fn();

vi.mock('./CalendarView', () => ({
    default: () => <div data-testid="calendar-view">Mock Calendar View</div>
}));
vi.mock('react-qr-code', () => ({
    default: () => <div data-testid="qr-code">QR Code</div>
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
        visibility: 'PUBLIC',
        registered_count: 5,
        category: 'General'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/users/sync')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => ({role: 'Admin'}),
                });
            }

            if (url.includes('/notifications')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                });
            }

            if (url.includes('/events')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [mockEvent],
                });
            }

            if (url.includes('/registrations/me')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [],
                });
            }

            return Promise.resolve({ok: true, json: async () => ({})});
        });
    });

    it('renders the dashboard header', () => {
        renderWithProviders(<EventDashboard/>);
        expect(screen.getByText(/Event Dashboard/i)).toBeInTheDocument();
    });

    it('fetches events and displays them', async () => {
        renderWithProviders(<EventDashboard/>);

        await waitFor(() => {
            const elements = screen.getAllByText('Interaction Test Event');
            expect(elements.length).toBeGreaterThan(0);
        });
    });

    it('allows user to register for an event', async () => {
        renderWithProviders(<EventDashboard/>);

        const joinBtn = await screen.findByRole('button', {name: /Join/i});

        (globalThis.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/registrations') && !url.includes('/me')) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({status: 'REGISTERED'}),
                });
            }
            return Promise.resolve({ok: true, json: async () => []});
        });

        fireEvent.click(joinBtn);
        await waitFor(() => {
            expect(screen.getByText(/Success! You are registered/i)).toBeInTheDocument();
        });
    });

    it('shows Create Form only for Admins', async () => {
        renderWithProviders(<EventDashboard/>);
        await waitFor(() => {
            expect(screen.getByText(/Create New Event/i)).toBeInTheDocument();
        });
    });

    it('switches to calendar view', async () => {
        renderWithProviders(<EventDashboard/>);

        const calBtn = screen.getByRole('button', {name: 'Calendar'});
        fireEvent.click(calBtn);

        await waitFor(() => {
            expect(screen.getByTestId('calendar-view')).toBeInTheDocument();
        });
    });
});
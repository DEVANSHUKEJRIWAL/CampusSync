import { Calendar, momentLocalizer, type View, Views } from 'react-big-calendar';
import moment from 'moment';
import { useState, useCallback } from 'react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './CalendarView.css';

const localizer = momentLocalizer(moment);

interface Event {
    id: number;
    title: string;
    start_time: string;
    end_time: string;
    status: string;
}

interface Props {
    events: Event[];
    onEventClick: (event: any) => void;
}

export default function CalendarView({ events, onEventClick }: Props) {
    // 👇 NEW: Local state to control the calendar view and date
    const [view, setView] = useState<View>(Views.MONTH);
    const [date, setDate] = useState(new Date());

    const calendarEvents = events.map(evt => {
        let end = new Date(evt.start_time);
        if (evt.end_time) {
            end = new Date(evt.end_time);
        } else {
            end.setHours(end.getHours() + 1);
        }

        return {
            id: evt.id,
            title: evt.title,
            start: new Date(evt.start_time),
            end: end,
            resource: evt,
        };
    });

    // 👇 NEW: Handlers for navigation and view switching
    const handleNavigate = useCallback((newDate: Date) => setDate(newDate), []);
    const handleViewChange = useCallback((newView: View) => setView(newView), []);

    // 👇 NEW: Handle clicking on the "+X more" link (drills down to day view)
    const handleDrillDown = useCallback((date: Date) => {
        setDate(date);
        setView(Views.DAY);
    }, []);

    return (
        <div style={{ height: '800px', marginTop: '20px', marginBottom: '50px' }}>
            <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}

                // 👇 Controlled Props
                view={view}
                date={date}
                onNavigate={handleNavigate}
                onView={handleViewChange}

                // 👇 Interactions
                onSelectEvent={(e) => onEventClick(e.resource)}
                onDrillDown={handleDrillDown} // Handles clicking the date header or "+X more"

                views={['month', 'week', 'day']}
                defaultView={Views.MONTH}

                eventPropGetter={(event) => {
                    let backgroundColor = '#3b82f6'; // Default Blue
                    let border = '1px solid #2563eb';

                    switch (event.resource.status) {
                        case 'COMPLETED':
                            backgroundColor = '#9ca3af'; // Gray
                            border = '1px solid #6b7280';
                            break;
                        case 'IN_PROGRESS':
                            backgroundColor = '#10b981'; // Green
                            border = '1px solid #059669';
                            break;
                        case 'CANCELLED':
                            backgroundColor = '#ef4444'; // Red
                            border = '1px solid #dc2626';
                            break;
                    }

                    return {
                        style: {
                            backgroundColor,
                            border,
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            padding: '4px 8px'
                        }
                    };
                }}
            />
        </div>
    );
}
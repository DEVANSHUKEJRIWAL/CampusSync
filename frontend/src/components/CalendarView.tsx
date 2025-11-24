import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

// Setup the localizer for moment
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
    // Map your DB events to the format react-big-calendar expects
    const calendarEvents = events.map(evt => {
        // Handle missing end_time by defaulting to start + 1 hour
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
            resource: evt, // Store full object to pass back on click
        };
    });

    return (
        <div style={{ height: '500px', marginTop: '20px', background: 'white', padding: '20px', borderRadius: '8px' }}>
            <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                onSelectEvent={(e) => onEventClick(e.resource)}
                views={['month', 'week', 'day']}
                defaultView='month'
                eventPropGetter={(event) => {
                    // Style events based on status
                    let backgroundColor = '#3174ad';
                    if (event.resource.status === 'COMPLETED') backgroundColor = '#6c757d';
                    if (event.resource.status === 'IN_PROGRESS') backgroundColor = '#28a745';
                    if (event.resource.status === 'CANCELLED') backgroundColor = '#dc3545';
                    return { style: { backgroundColor } };
                }}
            />
        </div>
    );
}
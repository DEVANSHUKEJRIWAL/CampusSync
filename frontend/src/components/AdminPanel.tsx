import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";

interface User {
    id: number;
    email: string;
    role: string;
}

export default function AdminPanel() {
    const { getAccessTokenSilently } = useAuth0();
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/admin/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) setUsers(await res.json());
        } catch (e) {
            console.error(e);
        }
    };

    const updateRole = async (userId: number, newRole: string) => {
        try {
            const token = await getAccessTokenSilently();

            const res = await fetch("http://localhost:8080/api/admin/users/role", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ user_id: userId, role: newRole })
            });

            // 👇 FIX: Check if the backend actually accepted it!
            if (!res.ok) {
                const errData = await res.json();
                alert(`❌ Failed: ${errData.message || "Unknown error"}`);
                return;
            }

            alert("✅ Role Updated Successfully!");
            fetchUsers(); // Refresh the list

        } catch (error) {
            console.error(error);
            alert("❌ Network or Permission Error");
        }
    };

    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "2px solid #333", borderRadius: "8px" }}>
            <h2>👮 Admin Console</h2>
            <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                    <th style={{ padding: "10px" }}>ID</th>
                    <th style={{ padding: "10px" }}>Email</th>
                    <th style={{ padding: "10px" }}>Role</th>
                    <th style={{ padding: "10px" }}>Action</th>
                </tr>
                </thead>
                <tbody>
                {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "10px" }}>{u.id}</td>
                        <td style={{ padding: "10px" }}>{u.email}</td>
                        <td style={{ padding: "10px" }}>
                        <span style={{
                            padding: "4px 8px", borderRadius: "4px", fontSize: "12px",
                            background: u.role === "Admin" ? "#dc3545" : (u.role === "Organizer" ? "#ffc107" : "#e2e3e5"),
                            color: u.role === "Admin" ? "white" : "black"
                        }}>
                            {u.role}
                        </span>
                        </td>
                        <td style={{ padding: "10px" }}>
                            <select
                                value={u.role}
                                onChange={(e) => updateRole(u.id, e.target.value)}
                                style={{ padding: "5px" }}
                            >
                                <option value="Member">Member</option>
                                <option value="Organizer">Organizer</option>
                                <option value="Admin">Admin</option>
                            </select>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
import { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useToast } from "../context/ToastContext";

interface User {
    id: number;
    email: string;
    role: string;
}

export default function AdminPanel() {
    const { getAccessTokenSilently, user: authUser } = useAuth0(); // Get logged in user info
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState("");

    const SUPER_ADMIN_EMAIL = "devanshukejriwal24@gmail.com"; // Lock this email

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = await getAccessTokenSilently();
            const res = await fetch("http://localhost:8080/api/admin/users", {
                headers: { Authorization: `Bearer ${token}` }
            });
            if(res.ok) {
                const data = await res.json();
                setUsers(data);

                // Find my own role
                const me = data.find((u: User) => u.email === authUser?.email);
                if (me) setCurrentUserRole(me.role);
            }
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

            if (!res.ok) {
                const errData = await res.json();
                showToast(`Failed: ${errData.message}`, "error");
                return;
            }

            showToast("Role Updated Successfully!", "success");
            fetchUsers();

        } catch (error) {
            console.error(error);
            showToast("Network or Permission Error", "error");
        }
    };

    // Check if I am allowed to edit
    const canEdit = currentUserRole === "Admin";

    return (
        <div style={{ marginTop: "20px", padding: "20px", border: "2px solid #333", borderRadius: "8px", backgroundColor: "white" }}>
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
                                // 👇 Disable if:
                                // 1. I am not an admin
                                // 2. OR the target user is the Super Admin
                                disabled={!canEdit || u.email === SUPER_ADMIN_EMAIL}
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
// User management section
async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';

  try {
    const { users } = await API.get('/admin/users');

    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => `
      <tr data-id="${u.id}">
        <td>${u.id}</td>
        <td style="color:var(--text)">${escHtml(u.email)}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td><span class="badge badge-${u.confirmed ? 'yes' : 'no'}">${u.confirmed ? 'Yes' : 'No'}</span></td>
        <td style="color:var(--text-muted);font-size:12px">${fmtDate(u.created_at)}</td>
        <td>
          <div class="action-row">
            ${!u.confirmed ? `<button class="btn-sm success" onclick="confirmUser(${u.id})">Confirm</button>` : ''}
            <button class="btn-sm primary" onclick="editEmail(${u.id}, '${escHtml(u.email)}')">Email</button>
            <button class="btn-sm primary" onclick="editPassword(${u.id}, '${escHtml(u.email)}')">Password</button>
            <button class="btn-sm" onclick="editRole(${u.id}, '${u.role}', '${escHtml(u.email)}')">Role</button>
            ${u.role !== 'admin' ? `<button class="btn-sm danger" onclick="deleteUser(${u.id}, '${escHtml(u.email)}')">Delete</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${e.message}</td></tr>`;
  }
}

async function confirmUser(id) {
  try {
    await API.post(`/admin/users/${id}/confirm`);
    toast('User confirmed');
    loadUsers(); loadStats();
  } catch (e) { toast(e.message, 'error'); }
}

function editEmail(id, current) {
  Modal.open({
    titleText: 'Change Email',
    subText: `Current: ${current}`,
    bodyHTML: `
      <div class="field">
        <label>New Email</label>
        <input id="m-email" type="email" value="${escHtml(current)}" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:10px 14px;outline:none">
      </div>`,
    buttons: [
      { label: 'Cancel', cls: 'btn-sm', onClick: Modal.close },
      { label: 'Save', cls: 'btn-sm primary', onClick: async (btn) => {
        const val = document.getElementById('m-email').value.trim();
        if (!val) return;
        btn.disabled = true;
        try {
          await API.post(`/admin/users/${id}/set-email`, { newEmail: val });
          toast('Email updated');
          Modal.close(); loadUsers();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
      }},
    ],
  });
}

function editPassword(id, email) {
  Modal.open({
    titleText: 'Set Password',
    subText: `User: ${email}`,
    bodyHTML: `
      <div class="field">
        <label>New Password <span style="color:var(--text-muted);font-size:11px">(min. 8 chars)</span></label>
        <input id="m-pass" type="password" placeholder="••••••••" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);color:var(--text);padding:10px 14px;outline:none">
      </div>`,
    buttons: [
      { label: 'Cancel', cls: 'btn-sm', onClick: Modal.close },
      { label: 'Set Password', cls: 'btn-sm primary', onClick: async (btn) => {
        const val = document.getElementById('m-pass').value;
        if (val.length < 8) { toast('Min. 8 characters', 'error'); return; }
        btn.disabled = true;
        try {
          await API.post(`/admin/users/${id}/set-password`, { newPassword: val });
          toast('Password updated');
          Modal.close();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
      }},
    ],
  });
}

function editRole(id, current, email) {
  const other = current === 'admin' ? 'user' : 'admin';
  Modal.open({
    titleText: 'Change Role',
    subText: `User: ${email}`,
    bodyHTML: `<p style="font-size:13px;color:var(--text-muted)">Current role: <strong style="color:var(--text)">${current}</strong><br>Set to: <strong style="color:var(--accent)">${other}</strong></p>`,
    buttons: [
      { label: 'Cancel', cls: 'btn-sm', onClick: Modal.close },
      { label: `Set to ${other}`, cls: 'btn-sm primary', onClick: async (btn) => {
        btn.disabled = true;
        try {
          await API.post(`/admin/users/${id}/set-role`, { role: other });
          toast(`Role set to ${other}`);
          Modal.close(); loadUsers();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
      }},
    ],
  });
}

function deleteUser(id, email) {
  Modal.open({
    titleText: 'Delete User',
    subText: `This will permanently delete ${email} and all their data.`,
    bodyHTML: `<p style="font-size:13px;color:#e8888a">This action cannot be undone.</p>`,
    buttons: [
      { label: 'Cancel', cls: 'btn-sm', onClick: Modal.close },
      { label: 'Delete', cls: 'btn-sm danger', onClick: async (btn) => {
        btn.disabled = true;
        try {
          await API.delete(`/admin/users/${id}`);
          toast('User deleted');
          Modal.close(); loadUsers(); loadStats();
        } catch (e) { toast(e.message, 'error'); btn.disabled = false; }
      }},
    ],
  });
}

// Helpers
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}

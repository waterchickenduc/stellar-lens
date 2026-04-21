/* frontend/js/admin/invites.js — invite code management */

async function loadInvites() {
  const tbody = document.getElementById('invites-tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';
  try {
    const { codes } = await API.get('/admin/invites');
    if (!codes.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No invite codes yet.</td></tr>';
      return;
    }
    tbody.innerHTML = codes.map(c => {
      const isExpired  = new Date(c.expires_at) < new Date();
      const isFull     = c.max_uses > 0 && c.use_count >= c.max_uses;
      const statusLabel = isExpired ? 'expired' : isFull ? 'full' : 'active';
      const statusColor = isExpired || isFull ? 'var(--danger)' : 'var(--success)';
      const usageLabel  = c.max_uses > 0
        ? `${c.use_count} / ${c.max_uses}`
        : `${c.use_count} / ∞`;

      return `<tr>
        <td style="font-family:monospace;color:var(--accent);font-weight:600">${c.code}</td>
        <td><span style="color:${statusColor};font-size:0.8rem;font-weight:600">${statusLabel}</span></td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${usageLabel}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${fmtDate(c.expires_at)}</td>
        <td style="font-size:0.82rem;color:var(--text-muted)">${c.used_by_email || '—'}</td>
        <td>
          <button class="btn-sm danger" onclick="deleteInvite(${c.id})">Delete</button>
        </td>
      </tr>`;
    }).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Error: ${e.message}</td></tr>`;
  }
}

async function generateInvite() {
  Modal.open({
    titleText: 'Generate Invite Code',
    subText:   'Code expires after 30 days.',
    bodyHTML: `
      <div class="field" style="margin-bottom:0.75rem">
        <label style="font-size:0.82rem;color:var(--text-muted);display:block;margin-bottom:0.4rem">
          Max uses <span style="color:var(--text-muted);font-size:0.75rem">(0 = unlimited)</span>
        </label>
        <input id="m-max-uses" type="number" min="0" value="0"
               style="width:100%;background:var(--surface2);border:1px solid var(--border);
                      border-radius:var(--radius);color:var(--text);padding:0.5rem 0.75rem;outline:none">
      </div>
      <p style="font-size:0.78rem;color:var(--text-muted)">
        Set to 0 to allow unlimited registrations with this code — good for a Discord invite link.
      </p>`,
    buttons: [
      { label: 'Cancel', cls: 'btn-sm', onClick: Modal.close },
      { label: 'Generate', cls: 'btn-sm success', onClick: async (btn) => {
        const maxUses = parseInt(document.getElementById('m-max-uses').value) || 0;
        btn.disabled = true;
        try {
          const { code } = await API.post('/admin/invites', { maxUses });
          toast(`Code: ${code} · ${maxUses > 0 ? `max ${maxUses} uses` : 'unlimited uses'}`, 'success');
          Modal.close();
          loadInvites();
        } catch(e) {
          toast(e.message, 'error');
          btn.disabled = false;
        }
      }},
    ],
  });
}

async function purgeExpired() {
  try {
    const { deleted } = await API.delete('/admin/invites/expired');
    toast(`Purged ${deleted} expired/full code(s)`);
    loadInvites();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteInvite(id) {
  if (!confirm('Delete this invite code?')) return;
  try {
    await API.delete(`/admin/invites/${id}`);
    toast('Invite code deleted');
    loadInvites();
  } catch(e) { toast(e.message, 'error'); }
}

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

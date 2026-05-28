export class ApiClient {
  private static token: string | null = null;

  static setToken(token: string | null) {
    this.token = token;
  }

  static getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {})
    };
  }

  static async get(endpoint: string) {
    const res = await fetch(endpoint, { headers: this.getHeaders() });
    if (!res.ok) throw new Error(`GET ${endpoint} failed with status ${res.status}`);
    return res.json();
  }

  static async post(endpoint: string, body: any) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${endpoint} failed with status ${res.status}`);
    return res.json();
  }

  static async put(endpoint: string, body: any) {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${endpoint} failed with status ${res.status}`);
    return res.json();
  }

  static async delete(endpoint: string) {
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    if (!res.ok) throw new Error(`DELETE ${endpoint} failed with status ${res.status}`);
    return res.json();
  }
}

// Contacts API
export const apiGetContacts = () => ApiClient.get('/api/contacts');
export const apiGetContactCircles = () => ApiClient.get('/api/contact-circles');
export const apiRemoveContact = (id: string) => ApiClient.delete(`/api/contacts/${id}`);
export const apiBlockContact = (id: string) => ApiClient.put(`/api/contacts/${id}/circle`, { circle_type: 'blacklist' });
export const apiMoveContactToCircle = (id: string, type: string) => ApiClient.put(`/api/contacts/${id}/circle`, { circle_type: type });

// Groups API
export const apiGetGroups = () => ApiClient.get('/api/groups');
export const apiLeaveGroup = (id: string) => ApiClient.delete(`/api/groups/${id}/leave`);

// User API
export const apiGetUserProfile = () => ApiClient.get('/api/users/me');

// Messages API
export const apiGetMessages = (chatId: string, isGroup: boolean, offset: number, limit: number) => 
  ApiClient.get(`/api/messages/${chatId}?isGroup=${isGroup}&offset=${offset}&limit=${limit}`);
export const apiClearChat = (chatId: string, isGroup: boolean) => 
  ApiClient.delete(`/api/messages/${chatId}/clear?isGroup=${isGroup}`);
export const apiSearchMessages = (q: string, chatId?: string | null) => 
  ApiClient.get(chatId ? `/api/search?q=${encodeURIComponent(q)}&chatId=${chatId}` : `/api/search?q=${encodeURIComponent(q)}`);

// Feed API
export const apiGetFeed = () => ApiClient.get('/api/feed');

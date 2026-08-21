export type AuthMailMessage = {
  to: string;
  subject: string;
  text: string;
};

const outbox: AuthMailMessage[] = [];

export function takeAuthMailOutbox() {
  return outbox.splice(0, outbox.length);
}

export async function sendAuthMail(message: AuthMailMessage) {
  const from = process.env.MAIL_FROM ?? "VentureOS <noreply@localhost>";
  const key = process.env.RESEND_API_KEY;

  if (key) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not send email.");
    }

    return;
  }

  outbox.push(message);
  console.log(`[auth-mail] ${message.subject} → ${message.to}\n${message.text}`);
}

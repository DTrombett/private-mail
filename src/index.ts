import PostalMime from "postal-mime";
import { Resend } from "resend";

const parser = new PostalMime();
const streamToArrayBuffer = async (
	stream: ReadableStream<Uint8Array>,
	size: number
) => {
	let result = new Uint8Array(size);
	let bytesRead = 0;
	const reader = stream.getReader();

	while (true) {
		const { done, value } = await reader.read();

		if (done) break;
		result.set(value, bytesRead);
		bytesRead += value.length;
	}
	return result;
};

export default {
	email: async (message, env) => {
		if (message.from !== env.FROM_EMAIL)
			return message.forward(env.FORWARD_EMAIL);
		const rawEmail = await streamToArrayBuffer(message.raw, message.rawSize);
		const parsedEmail = await parser.parse(rawEmail);
		const [to, ...subject] = parsedEmail.subject!.split(" ");
		const resend = new Resend(env.RESEND_API_KEY);
		const res = await resend.emails.send({
			from: message.to,
			to,
			subject: subject.join(" "),
			html: parsedEmail.html!,
			text: parsedEmail.text!,
			attachments: parsedEmail.attachments.map((att) => ({
				content: Buffer.from(att.content),
				content_type: att.mimeType,
				filename: att.filename!,
			})),
			headers: { date: parsedEmail.date! },
		});

		console.log(
			parsedEmail.deliveredTo,
			parsedEmail.replyTo,
			parsedEmail.to,
			parsedEmail.headers.map((h) => Object.entries(h))
		);
		if (res.error) {
			message.setReject(res.error.message);
			throw new Error(res.error.message);
		}
		message.setReject("Correctly forwarded");
	},
	fetch: async (req) => {
		console.log(req.cf);
		return new Response(null, { status: 404 });
	},
} satisfies ExportedHandler<Env>;

import OrderChatClient from "@/components/chat/OrderChatClient";

export const metadata = { title: "Order chat" };

export default async function OrderChatPage({ params }) {
  const { orderId } = await params;
  return <OrderChatClient orderId={orderId} />;
}

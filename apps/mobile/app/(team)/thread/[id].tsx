import { useLocalSearchParams } from "expo-router";
import { Conversation } from "../../../components/conversation";

export default function TeamThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Conversation threadId={id} />;
}

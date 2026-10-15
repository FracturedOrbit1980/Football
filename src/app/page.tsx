import { HomeSwitch } from "@/components/cloud/home-switch";
import { ClubStart } from "@/components/club/club-start";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl">
      <HomeSwitch>
        <ClubStart />
      </HomeSwitch>
    </div>
  );
}

import ProgressBlock from "@/components/blocks/progress-block";
import DashboardDropdown from "@/components/dashboard-dropdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BarChart } from "lucide-react";
import { meets, messagesData, tasks, activityList, teamData, files } from "./data";
import Image from "next/image";
import TaskItem from "@/components/project/task-item";
import MessageListItem from "@/components/project/message-list-item";
import ActivityItem from "@/components/project/activity";
import TeamTable from "@/components/project/team-table";
import NotesCalendar from "@/components/project/notes-calendar";
import DealsDistributionChart from "@/components/project/deals-distribution-chart";
import { useTranslations } from "next-intl";

const ProjectPage = () => {
    const t = useTranslations("ProjectDashboard");
  return (
    <div></div>
  );
};

export default ProjectPage;
export interface AdminStats {
  totalUsers: number;
  totalBookings: number;
  totalEquipment: number;
  monthlyRevenue: number;
  totalCommission: number;
}

export interface MostRentedEquipment {
  equipmentId: string;
  title: string;
  bookingCount: number;
  totalRevenue: number;
}

export interface AdminDashboardData {
  stats: AdminStats;
  mostRented: MostRentedEquipment[];
  recentBookings: any[];
  pendingPayments: any[];
}

import dbConnect from '@/lib/mongoose';
import { User, IUser } from '@/models/User';
import { UserPlan } from '@/models/Analysis';
import type { User as GitHubUser } from '@/types/auth';

export class UserService {
  private static instance: UserService;

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async connect() {
    await dbConnect();
  }

  async findOrCreateUser(githubUser: GitHubUser): Promise<IUser> {
    await this.connect();
    
    let user = await User.findOne({ githubId: githubUser.id });
    
    if (!user) {
      user = new User({
        githubId: githubUser.id,
        email: githubUser.email,
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatarUrl,
        plan: UserPlan.BASIC,
        lastLoginAt: new Date()
      });
    } else {
      // Update user information
      user.email = githubUser.email;
      user.login = githubUser.login;
      user.name = githubUser.name;
      user.avatarUrl = githubUser.avatarUrl;
      user.lastLoginAt = new Date();
    }

    await user.save();
    return user;
  }

  async getUser(githubId: number): Promise<IUser | null> {
    await this.connect();
    return User.findOne({ githubId });
  }

  async updateUserPlan(githubId: number, plan: UserPlan): Promise<IUser | null> {
    await this.connect();
    return User.findOneAndUpdate(
      { githubId },
      { 
        $set: { plan },
        $currentDate: { lastLoginAt: true }
      },
      { new: true }
    );
  }

  async deleteUser(githubId: number): Promise<boolean> {
    await this.connect();
    const user = await User.findOne({ githubId });
    if (!user) return false;
    
    await user.deleteOne(); // This will trigger the cascade delete
    return true;
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    planDistribution: Record<UserPlan, number>;
    activeUsers: number; // Users who logged in within last 30 days
  }> {
    await this.connect();
    
    const [stats, planStats, activeStats] = await Promise.all([
      User.countDocuments(),
      User.aggregate([
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 }
          }
        }
      ]),
      User.countDocuments({
        lastLoginAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    const planDistribution = planStats.reduce((acc, { _id, count }) => {
      acc[_id as UserPlan] = count;
      return acc;
    }, {} as Record<UserPlan, number>);

    return {
      totalUsers: stats,
      planDistribution,
      activeUsers: activeStats
    };
  }
}

export const userService = UserService.getInstance(); 
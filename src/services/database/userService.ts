import dbConnect from '@/lib/mongoose';
import { User, IUser } from '@/models/User';
import { UserPlan } from '@/models/Analysis';
import type { User as GitHubUser } from '@/types/auth';

export class UserService {
  private static instance: UserService;
  private connectionTimeout = 5000; // 5 seconds timeout

  private constructor() {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  async connect() {
    return Promise.race([
      dbConnect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), this.connectionTimeout)
      )
    ]);
  }

  async findOrCreateUser(githubUser: GitHubUser): Promise<IUser> {
    try {
      await this.connect();
      
      let user = await User.findOne({ githubId: githubUser.id });
      
      if (!user) {
        // Create new user with retry logic
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            user = new User({
              githubId: githubUser.id,
              email: githubUser.email,
              login: githubUser.login,
              name: githubUser.name,
              avatarUrl: githubUser.avatarUrl,
              plan: UserPlan.BASIC,
              lastLoginAt: new Date()
            });
            await user.save();
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      } else {
        // Update user information with retry logic
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            user.email = githubUser.email;
            user.login = githubUser.login;
            user.name = githubUser.name;
            user.avatarUrl = githubUser.avatarUrl;
            user.lastLoginAt = new Date();
            await user.save();
            break;
          } catch (error) {
            if (attempt === 3) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      return user!;
    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      // Return a temporary user object if database operations fail
      return {
        githubId: githubUser.id,
        email: githubUser.email,
        login: githubUser.login,
        name: githubUser.name,
        avatarUrl: githubUser.avatarUrl,
        plan: UserPlan.BASIC,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      } as IUser;
    }
  }

  async getUser(githubId: number): Promise<IUser | null> {
    try {
      await this.connect();
      return User.findOne({ githubId });
    } catch (error) {
      console.error('Error in getUser:', error);
      return null;
    }
  }

  async updateUserPlan(githubId: number, plan: UserPlan): Promise<IUser | null> {
    try {
      await this.connect();
      return User.findOneAndUpdate(
        { githubId },
        { 
          $set: { plan },
          $currentDate: { lastLoginAt: true }
        },
        { new: true }
      );
    } catch (error) {
      console.error('Error in updateUserPlan:', error);
      return null;
    }
  }

  async deleteUser(githubId: number): Promise<boolean> {
    try {
      await this.connect();
      const user = await User.findOne({ githubId });
      if (!user) return false;
      
      await user.deleteOne();
      return true;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      return false;
    }
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    planDistribution: Record<UserPlan, number>;
    activeUsers: number;
  }> {
    try {
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
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return {
        totalUsers: 0,
        planDistribution: {} as Record<UserPlan, number>,
        activeUsers: 0
      };
    }
  }
}

export const userService = UserService.getInstance(); 
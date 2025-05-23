import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from './db';
import {
  User, Chicken, Resource, Transaction, Price, InsertUser,
  UserProfile, InsertUserProfile, gameSettings,
  MysteryBoxReward, InsertMysteryBoxReward, MysteryBoxContent,
  ReferralEarning, InsertReferralEarning, MilestoneReward,
  InsertMilestoneReward, SalaryPayment, InsertSalaryPayment,
  DailyReward, InsertDailyReward, ActiveBoost, InsertActiveBoost,
  milestoneThresholds, referralCommissionRates, SALARY_PER_REFERRAL,
  dailyRewardsByDay, boostTypes, SpinHistory, InsertSpinHistory,
  SpinReward, InsertSpinReward, dailySpinRewards, superJackpotRewards,
  AchievementBadge, InsertAchievementBadge, UserAchievement, InsertUserAchievement,
  DEFAULT_ACHIEVEMENT_BADGES, CHICKEN_LIFESPAN
} from "@shared/schema";
import {
  users, chickens, resources, transactions, prices,
  userProfiles, gameSettings as gameSettingsTable,
  mysteryBoxRewards, referralEarnings, milestoneRewards,
  salaryPayments, dailyRewards, activeBoosts, spinHistory, spinRewards,
  achievementBadges, userAchievements
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import pgSessionStore from "connect-pg-simple";
import { randomBytes } from "crypto";
import { hashPassword } from './auth-utils';
import { pool } from './db';

// Import the salary value per referral from shared schema

const MemoryStore = createMemoryStore(session);
const PGStore = pgSessionStore(session);

export interface IStorage {
  sessionStore: session.Store;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, amount: number): Promise<void>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  getUserReferrals(userId: number): Promise<User[]>;
  updateUserReferralEarnings(userId: number, amount: number): Promise<void>;
  updateUserTeamEarnings(userId: number, amount: number): Promise<void>;
  updateUserStreak(userId: number, streak: number): Promise<void>;
  updateLastDailyReward(userId: number, date: Date): Promise<void>;
  updateLastSalaryPaid(userId: number, date: Date): Promise<void>;
  updateUserTelegramId(userId: number, telegramId: string): Promise<void>;
  getAllUsersTelegramIds(): Promise<{ id: number; username: string; telegramId: string | null }[]>;

  // Chicken operations
  getChickensByUserId(userId: number): Promise<Chicken[]>;
  createChicken(userId: number, type: string): Promise<Chicken>;
  updateChickenHatchTime(chickenId: number): Promise<void>;
  deleteChicken(chickenId: number): Promise<void>;
  getChickenCountsByType(): Promise<{ type: string, count: number }[]>;
  checkAndUpdateChickenStatus(userId: number): Promise<void>;
  markChickenAsDead(chickenId: number): Promise<void>;

  // Resource operations
  getResourcesByUserId(userId: number): Promise<Resource>;
  updateResources(userId: number, updates: Partial<Resource>): Promise<Resource>;

  // Transaction operations
  createTransaction(
    userId: number,
    type: string,
    amount: number,
    transactionId?: string,
    referralCommission?: number,
    bankDetails?: string
  ): Promise<Transaction>;
  getTransactionsByUserId(userId: number): Promise<Transaction[]>;
  updateTransactionStatus(transactionId: string, status: string): Promise<void>;

  // Price operations
  getPrices(): Promise<Price[]>;
  updatePrice(itemType: string, price: number): Promise<void>;

  // User Profile operations
  getUserProfile(userId: number): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(userId: number, updates: Partial<InsertUserProfile>): Promise<UserProfile>;
  updateTutorialProgress(userId: number, step: number): Promise<UserProfile>;
  completeTutorial(userId: number): Promise<UserProfile>;
  disableTutorial(userId: number): Promise<UserProfile>;

  // Mystery Box operations
  purchaseMysteryBox(userId: number, boxType?: string): Promise<void>;
  openMysteryBox(userId: number, boxType?: string): Promise<MysteryBoxReward | null>;
  getMysteryBoxRewardsByUserId(userId: number): Promise<MysteryBoxReward[]>;
  createMysteryBoxReward(reward: InsertMysteryBoxReward): Promise<MysteryBoxReward>;
  claimMysteryBoxReward(rewardId: number): Promise<MysteryBoxReward>;

  // Referral operations
  createReferralEarning(earning: InsertReferralEarning): Promise<ReferralEarning>;
  getReferralEarningsByUserId(userId: number): Promise<ReferralEarning[]>;
  getUnclaimedReferralEarnings(userId: number): Promise<ReferralEarning[]>;
  claimReferralEarning(earningId: number): Promise<ReferralEarning>;

  // Milestone operations
  createMilestoneReward(milestone: InsertMilestoneReward): Promise<MilestoneReward>;
  getMilestoneRewardsByUserId(userId: number): Promise<MilestoneReward[]>;
  getUnclaimedMilestoneRewards(userId: number): Promise<MilestoneReward[]>;
  claimMilestoneReward(milestoneId: number): Promise<MilestoneReward>;

  // Salary operations
  createSalaryPayment(salary: InsertSalaryPayment): Promise<SalaryPayment>;
  getSalaryPaymentsByUserId(userId: number): Promise<SalaryPayment[]>;

  // Daily reward operations
  createDailyReward(reward: InsertDailyReward): Promise<DailyReward>;
  getDailyRewardsByUserId(userId: number): Promise<DailyReward[]>;
  claimDailyReward(rewardId: number): Promise<DailyReward>;
  getCurrentDailyReward(userId: number): Promise<DailyReward | undefined>;

  // Boost operations
  createBoost(boost: InsertActiveBoost): Promise<ActiveBoost>;
  getActiveBoostsByUserId(userId: number): Promise<ActiveBoost[]>;
  getActiveEggBoost(userId: number): Promise<number>; // Returns current multiplier

  // Game settings
  getSettings(): Promise<any>;

  // Admin methods
  getTransactions(): Promise<Transaction[]>;
  getTransactionByTransactionId(transactionId: string): Promise<Transaction | undefined>;
  updatePaymentAddress(address: string): Promise<void>;
  updateWithdrawalTax(percentage: number): Promise<void>;

  // Spin operations
  createSpinHistory(spin: InsertSpinHistory): Promise<SpinHistory>;
  getSpinHistoryByUserId(userId: number): Promise<SpinHistory[]>;
  updateUserLastSpin(userId: number): Promise<void>;
  updateUserExtraSpins(userId: number, spins: number): Promise<void>;
  
  // Spin rewards configuration operations
  createSpinReward(reward: InsertSpinReward): Promise<SpinReward>;
  getSpinRewardsByType(spinType: string): Promise<SpinReward[]>;
  updateSpinReward(id: number, updates: Partial<InsertSpinReward>): Promise<SpinReward>;
  deleteSpinReward(id: number): Promise<void>;
  
  // Achievement operations
  getAllAchievementBadges(): Promise<AchievementBadge[]>;
  getAchievementBadgeByCode(code: string): Promise<AchievementBadge | undefined>;
  createAchievementBadge(badge: InsertAchievementBadge): Promise<AchievementBadge>;
  getUserAchievements(userId: number): Promise<UserAchievement[]>;
  getUserAchievementsByBadgeId(userId: number, badgeId: number): Promise<UserAchievement | undefined>;
  createUserAchievement(achievement: InsertUserAchievement): Promise<UserAchievement>;
  
  // Spin reward operations
  createSpinReward(reward: InsertSpinReward): Promise<SpinReward>;
  getSpinRewardsByType(spinType: string): Promise<SpinReward[]>;
  updateSpinReward(id: number, updates: Partial<InsertSpinReward>): Promise<SpinReward>;
  deleteSpinReward(id: number): Promise<void>;
  initializeSpinRewards(): Promise<void>;
  updateUserAchievement(id: number, updates: Partial<UserAchievement>): Promise<UserAchievement>;
  getCompletedUserAchievements(userId: number): Promise<UserAchievement[]>;
  initializeAchievementBadges(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;
  private defaultPaymentAddress: string = "TRX8nHHo2Jd7H9ZwKhh6h8h";
  private defaultWithdrawalTax: number = 5;

  constructor() {
    // Create PostgreSQL session store
    this.sessionStore = new PGStore({
      pool: pool,           // Use the existing PostgreSQL connection pool
      tableName: 'session', // Name of the session table
      createTableIfMissing: true, // Automatically create the session table if it doesn't exist
    });
    this.initializeDefaults();
  }

  private async initializeDefaults() {
    try {
      await this.initializePrices();
      await this.initializeAdminUser(); // Make sure admin is initialized
      await this.initializeGameSettings();
      await this.initializeAchievementBadges(); // Initialize achievement badges
      await this.initializeSpinRewards(); // Initialize spin rewards
    } catch (error) {
      console.error("Error in initializeDefaults:", error);
      throw error;
    }
  }

  private async initializeGameSettings() {
    try {
      const [withdrawalTaxSetting] = await db.select()
        .from(gameSettingsTable)
        .where(eq(gameSettingsTable.settingKey, "withdrawal_tax"));

      if (!withdrawalTaxSetting) {
        await db.insert(gameSettingsTable).values({
          settingKey: "withdrawal_tax",
          settingValue: this.defaultWithdrawalTax.toString(),
        });
      }

      const [paymentAddressSetting] = await db.select()
        .from(gameSettingsTable)
        .where(eq(gameSettingsTable.settingKey, "payment_address"));

      if (!paymentAddressSetting) {
        await db.insert(gameSettingsTable).values({
          settingKey: "payment_address",
          settingValue: this.defaultPaymentAddress,
        });
      }
    } catch (error) {
      console.error("Error initializing game settings:", error);
      throw error;
    }
  }

  private async initializeAdminUser() {
    try {
      console.log("[Storage] Checking for admin user existence...");
      const adminExists = await this.getUserByUsername("adminraja");
      if (!adminExists) {
        console.log("[Storage] Admin user not found, creating new admin account...");
        const hashedPassword = await hashPassword("admin8751");
        await db.insert(users).values({
          username: "adminraja",
          password: hashedPassword,
          usdtBalance: "0",
          referralCode: "ADMIN",
          isAdmin: true
        });

        const [admin] = await db.select().from(users).where(eq(users.username, "adminraja"));
        console.log("[Storage] Created admin user with ID:", admin.id);

        await db.insert(resources).values({
          userId: admin.id,
          waterBuckets: 0,
          wheatBags: 0,
          eggs: 0
        });

        console.log("[Storage] Admin user created successfully with resources initialized");
      } else {
        console.log("[Storage] Admin user already exists with ID:", adminExists.id);
      }
    } catch (error) {
      console.error("[Storage] Error initializing admin user:", error);
      throw error;
    }
  }

  private async initializePrices() {
    try {
      const defaultPrices = [
        { itemType: "baby_chicken", price: "90" },
        { itemType: "regular_chicken", price: "150" },
        { itemType: "golden_chicken", price: "400" },
        { itemType: "water_bucket", price: "0.5" },
        { itemType: "wheat_bag", price: "0.5" },
        { itemType: "egg", price: "0.1" },
        { itemType: "mystery_box", price: "50" }
      ];

      for (const price of defaultPrices) {
        const [existing] = await db.select().from(prices).where(eq(prices.itemType, price.itemType));
        if (!existing) {
          await db.insert(prices).values(price);
        }
      }
      console.log("[Storage] Prices initialized successfully");
    } catch (error) {
      console.error("[Storage] Error initializing prices:", error);
      throw error;
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  // New method to update referral counts for users
  async updateReferralCounts(): Promise<void> {
    try {
      // Get all users
      const allUsers = await db.select().from(users);
      
      // For each user, count their referrals and update the count
      for (const user of allUsers) {
        // Get referrals for this user
        const referrals = await db.select()
          .from(users)
          .where(eq(users.referredBy, user.referralCode));
        
        // Update the referral count
        await db.update(users)
          .set({ referralCount: referrals.length })
          .where(eq(users.id, user.id));
        
        console.log(`Updated referral count for user ${user.id} to ${referrals.length}`);
      }
      
      console.log("Successfully updated referral counts for all users");
    } catch (error) {
      console.error("Error updating referral counts:", error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const referralCode = randomBytes(4).toString('hex');
      const [user] = await db.insert(users).values({
        ...insertUser,
        usdtBalance: "0",
        referralCode,
        isAdmin: false
      }).returning();

      await db.insert(resources).values({
        userId: user.id,
        waterBuckets: 0,
        wheatBags: 0,
        eggs: 0,
        mysteryBoxes: 0
      });

      // If user was referred by someone, update the referrer's count
      if (insertUser.referredBy) {
        try {
          const referrer = await this.getUserByReferralCode(insertUser.referredBy);
          if (referrer) {
            // Increment referrer's referral count
            await db.update(users)
              .set({ 
                referralCount: sql`${users.referralCount} + 1`
              })
              .where(eq(users.id, referrer.id));
            
            console.log(`Updated referral count for user ${referrer.id}`);
          }
        } catch (referralError) {
          console.error("Error updating referrer's referral count:", referralError);
          // Continue execution - don't fail user creation because of referral count issues
        }
      }

      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async updateUserBalance(userId: number, amount: number): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) throw new Error("User not found");

      const newBalance = parseFloat(user.usdtBalance) + amount;
      if (newBalance < 0) throw new Error("Insufficient USDT balance");

      await db.update(users)
        .set({ usdtBalance: newBalance.toFixed(2) })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user balance:", error);
      throw error;
    }
  }

  async getUserReferrals(userId: number): Promise<User[]> {
    try {
      const user = await this.getUser(userId);
      if (!user) throw new Error("User not found");

      return db.select().from(users).where(eq(users.referredBy, user.referralCode));
    } catch (error) {
      console.error("Error getting user referrals:", error);
      throw error;
    }
  }

  async updateUserReferralEarnings(userId: number, amount: number): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) throw new Error("User not found");

      const newEarnings = parseFloat(user.totalReferralEarnings || "0") + amount;

      await db.update(users)
        .set({ totalReferralEarnings: newEarnings.toFixed(2) })
        .where(eq(users.id, userId));

      // Check if user has reached any milestones
      await this.checkAndCreateMilestoneRewards(userId, newEarnings);
    } catch (error) {
      console.error("Error updating user referral earnings:", error);
      throw error;
    }
  }

  private async checkAndCreateMilestoneRewards(userId: number, totalEarnings: number): Promise<void> {
    try {
      for (const milestone of milestoneThresholds) {
        if (totalEarnings >= milestone.threshold) {
          // Check if milestone already exists
          const existingMilestones = await this.getMilestoneRewardsByUserId(userId);
          const alreadyAwarded = existingMilestones.some(m =>
            parseFloat(m.milestone.toString()) === milestone.threshold
          );

          if (!alreadyAwarded) {
            // Create new milestone reward
            await this.createMilestoneReward({
              userId,
              milestone: milestone.threshold.toString(),
              reward: milestone.reward.toString(),
              claimed: false
            });
          }
        }
      }
    } catch (error) {
      console.error("Error checking and creating milestone rewards:", error);
    }
  }

  async updateUserTeamEarnings(userId: number, amount: number): Promise<void> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) throw new Error("User not found");

      const newEarnings = parseFloat(user.totalTeamEarnings || "0") + amount;

      await db.update(users)
        .set({ totalTeamEarnings: newEarnings.toFixed(2) })
        .where(eq(users.id, userId));

      // Check if user has reached any salary thresholds
      await this.checkAndProcessMonthlySalary(userId, newEarnings);
    } catch (error) {
      console.error("Error updating user team earnings:", error);
      throw error;
    }
  }

  private async checkAndProcessMonthlySalary(userId: number, totalTeamEarnings: number): Promise<void> {
    try {
      const user = await this.getUser(userId);
      if (!user) return;

      // Get all direct referrals of this user
      const directReferrals = await this.getUserReferrals(userId);

      // Count referrals who have made at least one deposit
      let referralsWithDeposits = 0;

      for (const referral of directReferrals) {
        // Check if this referral has made any deposits
        const referralTransactions = await this.getTransactionsByUserId(referral.id);
        const hasDeposit = referralTransactions.some(
          transaction => transaction.type === 'recharge' && transaction.status === 'completed'
        );

        if (hasDeposit) {
          referralsWithDeposits++;
        }
      }

      // Calculate salary (direct proportion: 100 referrals = $100)
      const eligibleSalary = referralsWithDeposits * SALARY_PER_REFERRAL;

      if (eligibleSalary > 0) {
        // Check if a payment for the current month already exists
        const currentDate = new Date();
        const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

        const salaryPayments = await this.getSalaryPaymentsByUserId(userId);
        const alreadyPaid = salaryPayments.some(payment => payment.period === currentMonth);

        if (!alreadyPaid) {
          // Only pay if last payment was at least a month ago
          const lastPaidAt = user.lastSalaryPaidAt;
          const shouldPay = !lastPaidAt ||
            (currentDate.getTime() - new Date(lastPaidAt).getTime() >= 28 * 24 * 60 * 60 * 1000);

          if (shouldPay) {
            // Create a new salary payment
            await this.createSalaryPayment({
              userId,
              amount: eligibleSalary.toString(),
              period: currentMonth
            });

            // Update user balance
            await this.updateUserBalance(userId, eligibleSalary);

            // Update last salary paid date
            await this.updateLastSalaryPaid(userId, currentDate);
          }
        }
      }
    } catch (error) {
      console.error("Error checking and processing monthly salary:", error);
    }
  }

  async updateUserStreak(userId: number, streak: number): Promise<void> {
    try {
      await db.update(users)
        .set({ currentStreak: streak })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user streak:", error);
      throw error;
    }
  }

  async updateLastDailyReward(userId: number, date: Date): Promise<void> {
    try {
      await db.update(users)
        .set({ lastDailyRewardAt: date.toISOString().split('T')[0] }) // Convert to YYYY-MM-DD string
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating last daily reward:", error);
      throw error;
    }
  }

  async updateLastSalaryPaid(userId: number, date: Date): Promise<void> {
    try {
      await db.update(users)
        .set({ lastSalaryPaidAt: date }) // This works because timestamp column can take Date objects
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating last salary paid date:", error);
      throw error;
    }
  }

  async getChickensByUserId(userId: number): Promise<Chicken[]> {
    // First check and update chicken status for this user 
    await this.checkAndUpdateChickenStatus(userId);
    // Then return all chickens
    return db.select().from(chickens).where(eq(chickens.userId, userId));
  }

  async createChicken(userId: number, type: string): Promise<Chicken> {
    const [chicken] = await db.insert(chickens)
      .values({ 
        userId, 
        type,
        status: "alive",
        createdAt: new Date()
      })
      .returning();
    return chicken;
  }
  
  // Check if any baby chickens have reached the end of their lifespan
  async checkAndUpdateChickenStatus(userId: number): Promise<void> {
    try {
      // Get all alive baby chickens for this user
      const babyChickens = await db.select()
        .from(chickens)
        .where(
          and(
            eq(chickens.userId, userId),
            eq(chickens.type, "baby"),
            eq(chickens.status, "alive")
          )
        );
      
      const now = new Date();
      
      // Check each baby chicken's age
      for (const chicken of babyChickens) {
        if (chicken.createdAt) {
          const createdAt = new Date(chicken.createdAt);
          const chickAge = now.getTime() - createdAt.getTime();
          
          // If chicken has exceeded lifespan (40 days), mark as dead
          if (chickAge > CHICKEN_LIFESPAN.baby) {
            await this.markChickenAsDead(chicken.id);
          }
        }
      }
    } catch (error) {
      console.error("Error checking chicken status:", error);
    }
  }
  
  // Mark a chicken as dead
  async markChickenAsDead(chickenId: number): Promise<void> {
    try {
      await db.update(chickens)
        .set({ 
          status: "dead",
          deathDate: new Date()
        })
        .where(eq(chickens.id, chickenId));
    } catch (error) {
      console.error("Error marking chicken as dead:", error);
    }
  }

  async updateChickenHatchTime(chickenId: number): Promise<void> {
    await db.update(chickens)
      .set({ lastHatchTime: new Date() })
      .where(eq(chickens.id, chickenId));
  }

  async deleteChicken(chickenId: number): Promise<void> {
    await db.delete(chickens)
      .where(eq(chickens.id, chickenId));
  }

  async getChickenCountsByType(): Promise<{ type: string, count: number }[]> {
    const result = await db
      .select({
        type: chickens.type,
        count: sql`COUNT(*)`,
      })
      .from(chickens)
      .groupBy(chickens.type);

    // Explicitly convert count to number to satisfy TypeScript
    return result.map(item => {
      return {
        type: item.type,
        count: parseInt(String(item.count), 10)
      };
    });
  }

  async getResourcesByUserId(userId: number): Promise<Resource> {
    try {
      const [resource] = await db.select().from(resources).where(eq(resources.userId, userId));

      if (!resource) {
        // Create resources for this user if they don't exist
        const [newResource] = await db.insert(resources).values({
          userId,
          waterBuckets: 0,
          wheatBags: 0,
          eggs: 0,
          mysteryBoxes: 0
        }).returning();

        return newResource;
      }

      return resource;
    } catch (error) {
      console.error("Error fetching or creating resources:", error);
      throw new Error("Failed to create resources");
    }
  }

  async updateResources(userId: number, updates: Partial<Resource>): Promise<Resource> {
    // Resources in the schema are defined as integers (not text), so we keep them as numbers
    const [updated] = await db.update(resources)
      .set(updates)
      .where(eq(resources.userId, userId))
      .returning();
    return updated;
  }

  async createTransaction(
    userId: number,
    type: string,
    amount: number,
    transactionId?: string,
    referralCommission?: number,
    bankDetails?: string
  ): Promise<Transaction> {
    const [transaction] = await db.insert(transactions)
      .values({
        userId,
        type,
        amount: amount.toString(),
        status: "pending",
        transactionId: transactionId || randomBytes(16).toString('hex'),
        referralCommission: referralCommission?.toString(),
        bankDetails
      })
      .returning();
    return transaction;
  }

  async getTransactionsByUserId(userId: number): Promise<Transaction[]> {
    return db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async updateTransactionStatus(transactionId: string, status: string): Promise<void> {
    await db.update(transactions)
      .set({ status })
      .where(eq(transactions.transactionId, transactionId));
  }

  async getPrices(): Promise<Price[]> {
    return db.select().from(prices);
  }

  async updatePrice(itemType: string, price: number): Promise<void> {
    await db.update(prices)
      .set({ price: price.toFixed(2) })  // Ensure price is stored as string with 2 decimal places
      .where(eq(prices.itemType, itemType));
  }

  async getTransactions(): Promise<Transaction[]> {
    return db.select()
      .from(transactions)
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionByTransactionId(transactionId: string): Promise<Transaction | undefined> {
    const [transaction] = await db.select()
      .from(transactions)
      .where(eq(transactions.transactionId, transactionId));
    return transaction;
  }

  async updatePaymentAddress(address: string): Promise<void> {
    try {
      await db.update(gameSettingsTable)
        .set({ settingValue: address })
        .where(eq(gameSettingsTable.settingKey, "payment_address"));
    } catch (error) {
      console.error("Error updating payment address:", error);
      throw error;
    }
  }

  async updateWithdrawalTax(percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error("Withdrawal tax percentage must be between 0 and 100");
    }
    try {
      await db.update(gameSettingsTable)
        .set({ settingValue: percentage.toString() })
        .where(eq(gameSettingsTable.settingKey, "withdrawal_tax"));
    } catch (error) {
      console.error("Error updating withdrawal tax:", error);
      throw error;
    }
  }

  async getSettings(): Promise<any> {
    try {
      const settings = await db.select().from(gameSettingsTable);
      
      // Convert settings array to an object for easier access
      const settingsObject: Record<string, any> = {};
      for (const setting of settings) {
        settingsObject[setting.settingKey] = setting.settingValue;
      }
      
      return {
        withdrawalTax: parseFloat(settingsObject.withdrawal_tax || this.defaultWithdrawalTax.toString()),
        paymentAddress: settingsObject.payment_address || this.defaultPaymentAddress
      };
    } catch (error) {
      console.error("Error getting game settings:", error);
      return {
        withdrawalTax: this.defaultWithdrawalTax,
        paymentAddress: this.defaultPaymentAddress
      };
    }
  }

  async getUserProfile(userId: number): Promise<UserProfile | undefined> {
    const [profile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const [newProfile] = await db.insert(userProfiles)
      .values({
        ...profile,
        avatarColor: profile.avatarColor || "#6366F1",
        avatarStyle: profile.avatarStyle || "default",
        farmBackground: profile.farmBackground || "default"
      })
      .returning();
    return newProfile;
  }

  async updateUserProfile(userId: number, updates: Partial<InsertUserProfile>): Promise<UserProfile> {
    const [currentProfile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));

    if (!currentProfile) {
      return this.createUserProfile({
        userId,
        ...updates,
      });
    }

    const [updatedProfile] = await db.update(userProfiles)
      .set({
        ...updates,
        lastUpdated: new Date()
      })
      .where(eq(userProfiles.userId, userId))
      .returning();

    return updatedProfile;
  }

  async updateTutorialProgress(userId: number, step: number): Promise<UserProfile> {
    try {
      const [currentProfile] = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));

      if (!currentProfile) {
        return this.createUserProfile({
          userId,
          tutorialStep: step,
        });
      }
      
      const [updatedProfile] = await db.update(userProfiles)
        .set({
          tutorialStep: step,
          lastUpdated: new Date()
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      return updatedProfile;
    } catch (error) {
      console.error("Error updating tutorial progress:", error);
      throw error;
    }
  }

  async completeTutorial(userId: number): Promise<UserProfile> {
    try {
      const [currentProfile] = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));

      if (!currentProfile) {
        return this.createUserProfile({
          userId,
          tutorialCompleted: true,
        });
      }
      
      const [updatedProfile] = await db.update(userProfiles)
        .set({
          tutorialCompleted: true,
          lastUpdated: new Date()
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      return updatedProfile;
    } catch (error) {
      console.error("Error completing tutorial:", error);
      throw error;
    }
  }

  async disableTutorial(userId: number): Promise<UserProfile> {
    try {
      const [currentProfile] = await db.select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId));

      if (!currentProfile) {
        return this.createUserProfile({
          userId,
          tutorialDisabled: true,
        });
      }
      
      const [updatedProfile] = await db.update(userProfiles)
        .set({
          tutorialDisabled: true,
          lastUpdated: new Date()
        })
        .where(eq(userProfiles.userId, userId))
        .returning();

      return updatedProfile;
    } catch (error) {
      console.error("Error disabling tutorial:", error);
      throw error;
    }
  }

  // Mystery Box operations
  async purchaseMysteryBox(userId: number, boxType: string = 'basic'): Promise<void> {
    try {
      console.log(`[MysteryBox] Purchasing box type ${boxType} for user ${userId}`);

      // Validate box type
      const boxConfig = mysteryBoxTypes[boxType];
      if (!boxConfig) {
        throw new Error("Invalid mystery box type");
      }

      // Check user balance
      const user = await this.getUser(userId);
      if (!user) throw new Error("User not found");

      const userBalance = parseFloat(user.usdtBalance);
      if (userBalance < boxConfig.price) {
        throw new Error("Insufficient USDT balance");
      }

      // Update user's balance
      await this.updateUserBalance(userId, -boxConfig.price);

      // Update user's mystery box count
      const resource = await this.getResourcesByUserId(userId);
      await this.updateResources(userId, {
        ...resource,
        mysteryBoxes: (resource.mysteryBoxes || 0) + 1
      });

      // Create transaction record
      await this.createTransaction(
        userId,
        "mystery_box",
        boxConfig.price,
        undefined,
        undefined,
        JSON.stringify({ action: "purchase", boxType })
      );

      console.log(`[MysteryBox] Successfully purchased box for user ${userId}`);
    } catch (error) {
      console.error("[MysteryBox] Error purchasing box:", error);
      throw error;
    }
  }

  async openMysteryBox(userId: number, boxType: string = 'basic'): Promise<MysteryBoxReward | null> {
    try {
      console.log(`[MysteryBox] Opening box for user ${userId}, type: ${boxType}`);
      const reward = await this.checkAndProcessMysteryBoxOpen(userId, boxType);
      console.log(`[MysteryBox] Successfully opened box with ID ${reward.id}:`, reward);
      return reward;
    } catch (error) {
      console.error("[MysteryBox] Error opening mystery box:", error);
      return null;
    }
  }

  private async checkAndProcessMysteryBoxOpen(userId: number, boxType: string): Promise<MysteryBoxReward> {
    try {
      // Get user resources and verify box availability
      const resource = await this.getResourcesByUserId(userId);
      console.log(`[MysteryBox] User resources:`, resource);

      if (!resource.mysteryBoxes || resource.mysteryBoxes <= 0) {
        throw new Error("No mystery boxes available");
      }

      // Validate box type
      const boxConfig = mysteryBoxTypes[boxType];
      if (!boxConfig) {
        throw new Error("Invalid box type");
      }

      // Generate reward and rarity
      const reward = this.getRandomReward(boxType);
      const rarity = this.determineRarity(boxType);
      console.log(`[MysteryBox] Generated reward:`, reward, `rarity:`, rarity);

      // Create reward record
      const mysteryBoxReward = await this.createMysteryBoxReward({
        userId,
        boxType,
        rewardType: reward.rewardType,
        rewardDetails: reward,
        rarity,
        opened: false
      });

      console.log(`[MysteryBox] Created reward with ID ${mysteryBoxReward.id}:`, mysteryBoxReward);

      // Update mystery box count
      await this.updateResources(userId, {
        ...resource,
        mysteryBoxes: resource.mysteryBoxes - 1
      });

      return mysteryBoxReward;
    } catch (error) {
      console.error("[MysteryBox] Error processing mystery box open:", error);
      throw error;
    }
  }

  private getRandomReward(boxType: string): MysteryBoxContent {
    try {
      const boxConfig = mysteryBoxTypes[boxType];
      if (!boxConfig) throw new Error("Invalid box type");

      const rand = Math.random();
      let threshold = 0;

      // Check for USDT reward
      if (boxConfig.rewards.usdt?.ranges) {
        for (const range of boxConfig.rewards.usdt.ranges) {
          threshold += range.chance;
          if (rand < threshold) {
            return {
              rewardType: "usdt",
              amount: range.amount
            };
          }
        }
      }

      // Check for chicken reward
      if (boxConfig.rewards.chicken) {
        threshold += boxConfig.rewards.chicken.chance;
        if (rand < threshold) {
          const chickenTypes = boxConfig.rewards.chicken.types;
          const randomChickenType = chickenTypes[Math.floor(Math.random() * chickenTypes.length)];
          return {
            rewardType: "chicken",
            chickenType: randomChickenType
          };
        }
      }

      // Check for eggs
      if (boxConfig.rewards.eggs?.ranges) {
        for (const range of boxConfig.rewards.eggs.ranges) {
          threshold += range.chance;
          if (rand < threshold) {
            const eggAmount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
            return {
              rewardType: "eggs",
              minEggs: eggAmount,
              maxEggs: eggAmount
            };
          }
        }
      }

      // Default to resources
      if (boxConfig.rewards.resources) {
        const resourceType = Math.random() < 0.5 ? "wheat_bags" : "water_buckets";
        const resourceKey = resourceType === "wheat_bags" ? "wheat" : "water";
        
        // Check if the specific resource exists
        if (boxConfig.rewards.resources[resourceKey] && boxConfig.rewards.resources[resourceKey]?.ranges) {
          const ranges = boxConfig.rewards.resources[resourceKey]?.ranges || [];
          if (ranges.length > 0) {
            const range = ranges[0];
            const amount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;

            return {
              rewardType: "resources",
              resourceType,
              resourceAmount: amount
            };
          }
        }
      }

      // Absolute fallback
      return {
        rewardType: "eggs",
        minEggs: 1,
        maxEggs: 5
      };
    } catch (error) {
      console.error("[MysteryBox] Error generating random reward:", error);
      return {
        rewardType: "eggs",
        minEggs: 1,
        maxEggs: 5
      };
    }
  }

  private determineRarity(boxType: string): string {
    try {
      const boxConfig = mysteryBoxTypes[boxType];
      if (!boxConfig) {
        throw new Error("Invalid box type");
      }
      
      // Default rarity system if none is defined in the box config
      const rarityDistribution = {
        common: 0.60,
        rare: 0.30,
        epic: 0.09,
        legendary: 0.01
      };

      const rand = Math.random();
      let threshold = 0;

      for (const [rarity, chance] of Object.entries(rarityDistribution)) {
        threshold += chance;
        if (rand < threshold) {
          return rarity;
        }
      }

      return "common"; // Fallback
    } catch (error) {
      console.error("[MysteryBox] Error determining rarity:", error);
      return "common"; // Safe fallback
    }
  }

  async claimMysteryBoxReward(rewardId: number): Promise<MysteryBoxReward> {
    try {
      if (typeof rewardId !== 'number' || rewardId <= 0) {
        console.error(`[MysteryBox] Invalid reward ID: ${rewardId}`);
        throw new Error("Invalid reward ID");
      }

      console.log(`[MysteryBox] Attempting to claim reward ${rewardId}`);

      const [reward] = await db.select()
        .from(mysteryBoxRewards)
        .where(eq(mysteryBoxRewards.id, rewardId));

      if (!reward) {
        console.error(`[MysteryBox] Reward not found for ID: ${rewardId}`);
        throw new Error("Reward not found");
      }

      if (reward.opened) {
        console.error(`[MysteryBox] Reward ${rewardId} already claimed`);
        throw new Error("Reward already claimed");
      }

      const rewardData = reward.rewardDetails as MysteryBoxContent;
      console.log(`[MysteryBox] Processing reward:`, rewardData);

      // Process the reward based on its type
      switch (rewardData.rewardType) {
        case "usdt":
          if ('amount' in rewardData && rewardData.amount) {
            await this.updateUserBalance(reward.userId, rewardData.amount);
          }
          break;
        case "chicken":
          if ('chickenType' in rewardData && rewardData.chickenType) {
            await this.createChicken(reward.userId, rewardData.chickenType);
          }
          break;
        case "eggs":
          if ('minEggs' in rewardData && rewardData.minEggs) {
            const userResources = await this.getResourcesByUserId(reward.userId);
            await this.updateResources(reward.userId, {
              ...userResources,
              eggs: userResources.eggs + rewardData.minEggs
            });
          }
          break;
        case "resources":
          if ('resourceType' in rewardData && 'resourceAmount' in rewardData && rewardData.resourceAmount) {
            const userRes = await this.getResourcesByUserId(reward.userId);
            const resourceMapping = {
              "wheat_bags": "wheatBags",
              "water_buckets": "waterBuckets"
            };
            
            if (rewardData.resourceType === "wheat_bags" || rewardData.resourceType === "water_buckets") {
              const propertyName = resourceMapping[rewardData.resourceType as keyof typeof resourceMapping];
              await this.updateResources(reward.userId, {
                ...userRes,
                [propertyName]: (userRes[propertyName as keyof Resource] as number) + rewardData.resourceAmount
              });
            }
          }
          break;
        default:
          console.error(`[MysteryBox]Invalid reward type: ${rewardData.rewardType}`);
          throw new Error(`Invalid reward type: ${rewardData.rewardType}`);
      }

      // Mark reward as claimed
      const [updatedReward] = await db.update(mysteryBoxRewards)
        .set({
          opened: true,
          claimedAt: new Date()
        })
        .where(eq(mysteryBoxRewards.id, rewardId))
        .returning();

      console.log(`[MysteryBox] Successfully claimed reward:`, updatedReward);
      return updatedReward;
    } catch (error) {
      console.error("[MysteryBox] Error claiming reward:", error);
      throw error;
    }
  }

  async getMysteryBoxRewardsByUserId(userId: number): Promise<MysteryBoxReward[]> {
    try {
      console.log(`[MysteryBox] Fetching rewards for user ${userId}`);
      const rewards = await db.select()
        .from(mysteryBoxRewards)
        .where(eq(mysteryBoxRewards.userId, userId))
        .orderBy(desc(mysteryBoxRewards.createdAt));

      console.log(`[MysteryBox] Retrieved rewards for user ${userId}:`, rewards.length);
      return rewards;
    } catch (error) {
      console.error("Error getting mystery box rewards:", error);
      throw error;
    }
  }

  async createMysteryBoxReward(reward: InsertMysteryBoxReward): Promise<MysteryBoxReward> {
    try {
      const [newReward] = await db.insert(mysteryBoxRewards)
        .values(reward)
        .returning();
      return newReward;
    } catch (error) {
      console.error("Error creating mystery box reward:", error);
      throw error;
    }
  }

  async createReferralEarning(earning: InsertReferralEarning): Promise<ReferralEarning> {
    try {
      const [newEarning] = await db.insert(referralEarnings)
        .values(earning)
        .returning();
      return newEarning;
    } catch (error) {
      console.error("Error creating referral earning:", error);
      throw error;
    }
  }

  async getReferralEarningsByUserId(userId: number): Promise<ReferralEarning[]> {
    try {
      return db.select()
        .from(referralEarnings)
        .where(eq(referralEarnings.userId, userId))
        .orderBy(desc(referralEarnings.createdAt));
    } catch (error) {
      console.error("Error getting referral earnings by user ID:", error);
      throw error;
    }
  }

  async getUnclaimedReferralEarnings(userId: number): Promise<ReferralEarning[]> {
    try {
      return db.select()
        .from(referralEarnings)
        .where(and(
          eq(referralEarnings.userId, userId),
          eq(referralEarnings.claimed, false)
        ))
        .orderBy(desc(referralEarnings.createdAt));
    } catch (error) {
      console.error("Error getting unclaimed referral earnings:", error);
      throw error;
    }
  }

  // Update resource eggs - this modifies the eggs count for a user
  async updateResourceEggs(userId: number, eggAmount: number): Promise<void> {
    try {
      const userResources = await this.getResourcesByUserId(userId);
      if (!userResources) {
        throw new Error("User resources not found");
      }
      
      const currentEggs = userResources.eggs;
      const newEggAmount = currentEggs + eggAmount;
      
      await this.updateResources(userId, {
        eggs: newEggAmount
      });
    } catch (error) {
      console.error("Error updating resource eggs:", error);
      throw error;
    }
  }
  
  // Update resource wheat - this modifies the wheat bags count for a user
  async updateResourceWheat(userId: number, wheatAmount: number): Promise<void> {
    try {
      const userResources = await this.getResourcesByUserId(userId);
      if (!userResources) {
        throw new Error("User resources not found");
      }
      
      const currentWheat = userResources.wheatBags;
      const newWheatAmount = currentWheat + wheatAmount;
      
      await this.updateResources(userId, {
        wheatBags: newWheatAmount
      });
    } catch (error) {
      console.error("Error updating resource wheat:", error);
      throw error;
    }
  }
  
  // Update resource water - this modifies the water buckets count for a user
  async updateResourceWater(userId: number, waterAmount: number): Promise<void> {
    try {
      const userResources = await this.getResourcesByUserId(userId);
      if (!userResources) {
        throw new Error("User resources not found");
      }
      
      const currentWater = userResources.waterBuckets;
      const newWaterAmount = currentWater + waterAmount;
      
      await this.updateResources(userId, {
        waterBuckets: newWaterAmount
      });
    } catch (error) {
      console.error("Error updating resource water:", error);
      throw error;
    }
  }
  
  // Update user's extra spins - different from updateUserExtraSpins to handle different parameter names
  async updateExtraSpinsAvailable(userId: number, extraSpins: number): Promise<void> {
    try {
      return this.updateUserExtraSpins(userId, extraSpins);
    } catch (error) {
      console.error("Error updating user's extra spins:", error);
      throw error;
    }
  }

  async claimReferralEarning(earningId: number): Promise<ReferralEarning> {
    try {
      const [earning] = await db.select()
        .from(referralEarnings)
        .where(eq(referralEarnings.id, earningId));

      if (!earning) {
        throw new Error("Referral earning not found");
      }

      if (earning.claimed) {
        throw new Error("Referral earning already claimed");
      }

      // Add to user balance
      await this.updateUserBalance(earning.userId, parseFloat(earning.amount.toString()));

      // Mark as claimed
      const [updated] = await db.update(referralEarnings)
        .set({ claimed: true })
        .where(eq(referralEarnings.id, earningId))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error claiming referral earning:", error);
      throw error;
    }
  }

  // Milestone operations
  async createMilestoneReward(milestone: InsertMilestoneReward): Promise<MilestoneReward> {
    try {
      const [newMilestone] = await db.insert(milestoneRewards)
        .values(milestone)
        .returning();
      return newMilestone;
    } catch (error) {
      console.error("Error creating milestone reward:", error);
      throw error;
    }
  }

  async getMilestoneRewardsByUserId(userId: number): Promise<MilestoneReward[]> {
    try {
      return db.select()
        .from(milestoneRewards)
        .where(eq(milestoneRewards.userId, userId))
        .orderBy(desc(milestoneRewards.createdAt));
    } catch (error) {
      console.error("Error getting milestone rewards by user ID:", error);
      throw error;
    }
  }

  async getUnclaimedMilestoneRewards(userId: number): Promise<MilestoneReward[]> {
    try {
      return db.select()
        .from(milestoneRewards)
        .where(and(
          eq(milestoneRewards.userId, userId),
          eq(milestoneRewards.claimed, false)
        ))
        .orderBy(desc(milestoneRewards.createdAt));
    } catch (error) {
      console.error("Error getting unclaimed milestone rewards:", error);
      throw error;
    }
  }

  async claimMilestoneReward(milestoneId: number): Promise<MilestoneReward> {
    try {
      const [milestone] = await db.select()
        .from(milestoneRewards)
        .where(eq(milestoneRewards.id, milestoneId));

      if (!milestone) {
        throw new Error("Milestone reward not found");
      }

      if (milestone.claimed) {
        throw new Error("Milestone reward already claimed");
      }

      // Add to user balance
      await this.updateUserBalance(milestone.userId, parseFloat(milestone.reward.toString()));

      // Mark as claimed
      const now = new Date();
      const [updated] = await db.update(milestoneRewards)
        .set({
          claimed: true,
          claimedAt: now
        })
        .where(eq(milestoneRewards.id, milestoneId))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error claiming milestone reward:", error);
      throw error;
    }
  }

  // Salary operations
  async createSalaryPayment(salary: InsertSalaryPayment): Promise<SalaryPayment> {
    try {
      const [newSalary] = await db.insert(salaryPayments)
        .values(salary)
        .returning();
      return newSalary;
    } catch (error) {
      console.error("Error creating salary payment:", error);
      throw error;
    }
  }

  async getSalaryPaymentsByUserId(userId: number): Promise<SalaryPayment[]> {
    try {
      return db.select()
        .from(salaryPayments)
        .where(eq(salaryPayments.userId, userId))
        .orderBy(desc(salaryPayments.paidAt));
    } catch (error) {
      console.error("Error getting salary payments by user ID:", error);
      throw error;
    }
  }

  // Daily reward operations
  async createDailyReward(reward: InsertDailyReward): Promise<DailyReward> {
    try {
      const [newReward] = await db.insert(dailyRewards)
        .values(reward)
        .returning();
      return newReward;
    } catch (error) {
      console.error("Error creating daily reward:", error);
      throw error;
    }
  }

  async getDailyRewardsByUserId(userId: number): Promise<DailyReward[]> {
    try {
      return db.select()
        .from(dailyRewards)
        .where(eq(dailyRewards.userId, userId))
        .orderBy(desc(dailyRewards.createdAt));
    } catch (error) {
      console.error("Error getting daily rewards by user ID:", error);
      throw error;
    }
  }

  async claimDailyReward(rewardId: number): Promise<DailyReward> {
    try {
      const [reward] = await db.select()
        .from(dailyRewards)
        .where(eq(dailyRewards.id, rewardId));

      if (!reward) {
        throw new Error("Daily reward not found");
      }

      if (reward.claimed) {
        throw new Error("Daily reward already claimed");
      }

      // Provide rewards to user
      const userId = reward.userId;

      // Add eggs to user's resources
      if (reward.eggs > 0) {
        const resource = await this.getResourcesByUserId(userId);
        await this.updateResources(userId, {
          eggs: resource.eggs + reward.eggs
        });
      }

      // Add USDT to user's balance
      const usdtAmount = reward.usdt ? parseFloat(reward.usdt.toString()) : 0;
      if (usdtAmount > 0) {
        await this.updateUserBalance(userId, usdtAmount);
      }

      // Mark as claimed
      const [updated] = await db.update(dailyRewards)
        .set({ claimed: true })
        .where(eq(dailyRewards.id, rewardId))
        .returning();

      return updated;
    } catch (error) {
      console.error("Error claiming daily reward:", error);
      throw error;
    }
  }

  async getCurrentDailyReward(userId: number): Promise<DailyReward | undefined> {
    try {
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error("User not found");
      }

      // Check if user already claimed today's reward
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [existingReward] = await db.select()
        .from(dailyRewards)
        .where(and(
          eq(dailyRewards.userId, userId),
          sql`DATE(${dailyRewards.createdAt}) = CURRENT_DATE`
        ))
        .orderBy(desc(dailyRewards.createdAt));

      if (existingReward) {
        return existingReward;
      }

      // Calculate streak
      let streak = user.currentStreak || 0;
      const lastRewardDate = user.lastDailyRewardAt;

      if (lastRewardDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const lastRewardDay = new Date(lastRewardDate);
        lastRewardDay.setHours(0, 0, 0, 0);

        if (lastRewardDay.getTime() >= yesterday.getTime()) {
          // User claimed reward yesterday, continue streak
          streak += 1;
          if (streak > 7) streak = 1; // Reset after 7-day cycle
        } else {
          // Streak broken
          streak = 1;
        }
      } else {
        // First day
        streak = 1;
      }

      // Get reward for current streak day
      const rewardData = dailyRewardsByDay.find(r => r.day === streak) || dailyRewardsByDay[0];

      // Create new daily reward
      const reward = await this.createDailyReward({
        userId,
        day: streak,
        eggs: rewardData.eggs,
        usdt: rewardData.usdt.toString(),
        claimed: false
      });

      // Update user streak
      await this.updateUserStreak(userId, streak);
      await this.updateLastDailyReward(userId, new Date());

      return reward;
    } catch (error) {
      console.error("Error getting current daily reward:", error);
      throw error;
    }
  }

  // Boost operations
  async createBoost(boost: InsertActiveBoost): Promise<ActiveBoost> {
    try {
      const [newBoost] = await db.insert(activeBoosts)
        .values(boost)
        .returning();
      return newBoost;
    } catch (error) {
      console.error("Error creating boost:", error);
      throw error;
    }
  }

  async getActiveBoostsByUserId(userId: number): Promise<ActiveBoost[]> {
    try {
      return db.select()
        .from(activeBoosts)
        .where(and(
          eq(activeBoosts.userId, userId),
          sql`${activeBoosts.expiresAt} > NOW()`
        ))
        .orderBy(desc(activeBoosts.expiresAt));
    } catch (error) {
      console.error("Error getting active boosts by user ID:", error);
      throw error;
    }
  }

  async getActiveEggBoost(userId: number): Promise<number> {
    try {
      const activeBoosts = await this.getActiveBoostsByUserId(userId);

      // Find highest egg production boost
      let highestMultiplier = 1; // Default (no boost)

      for (const boost of activeBoosts) {
        if (boost.type === "egg_production" && parseFloat(boost.multiplier.toString()) > highestMultiplier) {
          highestMultiplier = parseFloat(boost.multiplier.toString());
        }
      }

      return highestMultiplier;
    } catch (error) {
      console.error("Error getting active egg boost:", error);
      return 1; // Default in case of error
    }
  }

  // Spin operations
  async createSpinHistory(spin: InsertSpinHistory): Promise<SpinHistory> {
    try {
      console.log('[Storage] Creating spin history:', spin);
      const [record] = await db.insert(spinHistory)
        .values(spin)
        .returning();
      return record;
    } catch (error) {
      console.error('[Storage] Error creating spin history:', error);
      throw error;
    }
  }

  async getSpinHistoryByUserId(userId: number): Promise<SpinHistory[]> {
    try {
      console.log(`[Storage] Fetching spin history for user ${userId}`);
      return db.select()
        .from(spinHistory)
        .where(eq(spinHistory.userId, userId))
        .orderBy(desc(spinHistory.createdAt));
    } catch (error) {
      console.error('[Storage] Error getting spin history:', error);
      throw error;
    }
  }

  async updateUserLastSpin(userId: number): Promise<void> {
    try {
      console.log(`[Storage] Updating last spin time for user ${userId}`);
      await db.update(users)
        .set({ lastSpinAt: new Date() })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('[Storage] Error updating last spin time:', error);
      throw error;
    }
  }

  async updateUserExtraSpins(userId: number, spins: number): Promise<void> {
    try {
      console.log(`[Storage] Updating extra spins for user ${userId} to ${spins}`);
      await db.update(users)
        .set({ extraSpinsAvailable: spins })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('[Storage] Error updating extra spins:', error);
      throw error;
    }
  }

  // Spin Rewards Configuration methods
  async createSpinReward(reward: InsertSpinReward): Promise<SpinReward> {
    try {
      console.log('[Storage] Creating spin reward configuration:', reward);
      const [newReward] = await db.insert(spinRewards)
        .values({
          ...reward,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newReward;
    } catch (error) {
      console.error('[Storage] Error creating spin reward:', error);
      throw error;
    }
  }

  async getSpinRewardsByType(spinType: string): Promise<SpinReward[]> {
    try {
      console.log(`[Storage] Fetching spin rewards for type ${spinType}`);
      const results = await db.select().from(spinRewards).where(eq(spinRewards.spinType, spinType));
      console.log(`[Storage] Found ${results.length} ${spinType} spin rewards`);
      return results;
    } catch (error) {
      console.error('[Storage] Error fetching spin rewards by type:', error);
      throw error;
    }
  }

  async updateSpinReward(id: number, updates: Partial<InsertSpinReward>): Promise<SpinReward> {
    try {
      console.log(`[Storage] Updating spin reward ${id}:`, updates);
      const [updatedReward] = await db.update(spinRewards)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(spinRewards.id, id))
        .returning();
      return updatedReward;
    } catch (error) {
      console.error('[Storage] Error updating spin reward:', error);
      throw error;
    }
  }

  async deleteSpinReward(id: number): Promise<void> {
    try {
      console.log(`[Storage] Deleting spin reward ${id}`);
      await db.delete(spinRewards)
        .where(eq(spinRewards.id, id));
    } catch (error) {
      console.error('[Storage] Error deleting spin reward:', error);
      throw error;
    }
  }

  // Achievement badge methods
  async getAllAchievementBadges(): Promise<AchievementBadge[]> {
    try {
      return db.select().from(achievementBadges);
    } catch (error) {
      console.error("[Storage] Error getting all achievement badges:", error);
      throw error;
    }
  }

  async getAchievementBadgeByCode(code: string): Promise<AchievementBadge | undefined> {
    try {
      const [badge] = await db.select().from(achievementBadges).where(eq(achievementBadges.code, code));
      return badge;
    } catch (error) {
      console.error(`[Storage] Error getting achievement badge by code ${code}:`, error);
      throw error;
    }
  }

  async createAchievementBadge(badge: InsertAchievementBadge): Promise<AchievementBadge> {
    try {
      const [newBadge] = await db.insert(achievementBadges).values(badge).returning();
      return newBadge;
    } catch (error) {
      console.error("[Storage] Error creating achievement badge:", error);
      throw error;
    }
  }

  async getUserAchievements(userId: number): Promise<UserAchievement[]> {
    try {
      return db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    } catch (error) {
      console.error(`[Storage] Error getting achievements for user ${userId}:`, error);
      throw error;
    }
  }

  async getUserAchievementsByBadgeId(userId: number, badgeId: number): Promise<UserAchievement | undefined> {
    try {
      const [achievement] = await db.select().from(userAchievements)
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.badgeId, badgeId)
        ));
      return achievement;
    } catch (error) {
      console.error(`[Storage] Error getting user achievement for user ${userId} and badge ${badgeId}:`, error);
      throw error;
    }
  }

  async createUserAchievement(achievement: InsertUserAchievement): Promise<UserAchievement> {
    try {
      const [newAchievement] = await db.insert(userAchievements).values(achievement).returning();
      return newAchievement;
    } catch (error) {
      console.error("[Storage] Error creating user achievement:", error);
      throw error;
    }
  }

  async updateUserAchievement(id: number, updates: Partial<UserAchievement>): Promise<UserAchievement> {
    try {
      const [updatedAchievement] = await db.update(userAchievements)
        .set(updates)
        .where(eq(userAchievements.id, id))
        .returning();
      return updatedAchievement;
    } catch (error) {
      console.error(`[Storage] Error updating user achievement ${id}:`, error);
      throw error;
    }
  }

  async getCompletedUserAchievements(userId: number): Promise<UserAchievement[]> {
    try {
      return db.select().from(userAchievements)
        .where(and(
          eq(userAchievements.userId, userId),
          eq(userAchievements.isComplete, true)
        ));
    } catch (error) {
      console.error(`[Storage] Error getting completed achievements for user ${userId}:`, error);
      throw error;
    }
  }

  async initializeAchievementBadges(): Promise<void> {
    try {
      console.log("[Storage] Initializing achievement badges...");
      
      // Check if badges already exist
      const existingBadges = await this.getAllAchievementBadges();
      if (existingBadges.length > 0) {
        console.log(`[Storage] ${existingBadges.length} achievement badges already exist, skipping initialization`);
        return;
      }
      
      // Initialize default badges
      for (const badgeDef of DEFAULT_ACHIEVEMENT_BADGES) {
        await this.createAchievementBadge({
          code: badgeDef.code,
          name: badgeDef.name,
          description: badgeDef.description,
          category: badgeDef.category,
          rarity: badgeDef.rarity,
          threshold: badgeDef.threshold,
          iconSvg: badgeDef.iconSvg
        });
      }
      
      console.log(`[Storage] Successfully initialized ${DEFAULT_ACHIEVEMENT_BADGES.length} achievement badges`);
    } catch (error) {
      console.error("[Storage] Error initializing achievement badges:", error);
      throw error;
    }
  }
  
  async initializeSpinRewards(): Promise<void> {
    try {
      console.log("[Storage] Initializing spin rewards...");
      
      // Check if spin rewards already exist
      const existingDailyRewards = await this.getSpinRewardsByType('daily');
      const existingSuperRewards = await this.getSpinRewardsByType('super');
      
      if (existingDailyRewards.length === 0) {
        console.log("[Storage] No daily spin rewards found, initializing...");
        
        // Initialize daily spin rewards
        for (const rewardConfig of dailySpinRewards) {
          const { reward, probability } = rewardConfig;
          
          await this.createSpinReward({
            spinType: 'daily',
            rewardType: reward.type,
            amount: reward.amount.toString(),
            chickenType: reward.chickenType,
            probability: probability.toString()
          });
        }
        
        console.log(`[Storage] Successfully initialized ${dailySpinRewards.length} daily spin rewards`);
      } else {
        console.log(`[Storage] Found ${existingDailyRewards.length} daily spin rewards, skipping initialization`);
      }
      
      if (existingSuperRewards.length === 0) {
        console.log("[Storage] No super jackpot rewards found, initializing...");
        
        // Initialize super jackpot rewards
        for (const rewardConfig of superJackpotRewards) {
          const { reward, probability } = rewardConfig;
          
          await this.createSpinReward({
            spinType: 'super',
            rewardType: reward.type,
            amount: reward.amount.toString(),
            chickenType: reward.chickenType,
            probability: probability.toString()
          });
        }
        
        console.log(`[Storage] Successfully initialized ${superJackpotRewards.length} super jackpot rewards`);
      } else {
        console.log(`[Storage] Found ${existingSuperRewards.length} super jackpot rewards, skipping initialization`);
      }
      
    } catch (error) {
      console.error("[Storage] Error initializing spin rewards:", error);
      throw error;
    }
  }

  // Telegram ID methods
  async updateUserTelegramId(userId: number, telegramId: string): Promise<void> {
    try {
      console.log(`[Storage] Updating Telegram ID for user ${userId} to ${telegramId}`);
      await db.update(users)
        .set({ telegramId })
        .where(eq(users.id, userId));
      console.log(`[Storage] Successfully updated Telegram ID for user ${userId}`);
    } catch (error) {
      console.error(`[Storage] Error updating Telegram ID for user ${userId}:`, error);
      throw error;
    }
  }
  
  async getAllUsersTelegramIds(): Promise<{ id: number; username: string; telegramId: string | null }[]> {
    try {
      console.log('[Storage] Fetching all users with their Telegram IDs');
      const result = await db.select({
        id: users.id,
        username: users.username,
        telegramId: users.telegramId
      })
      .from(users)
      .orderBy(users.id);  // Get all users, ordered by ID
      
      console.log(`[Storage] Found ${result.length} users`);
      return result;
    } catch (error) {
      console.error('[Storage] Error fetching users with Telegram IDs:', error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();

export const mysteryBoxTypes: {
  [key: string]: {
    price: number;
    name: string;
    description?: string;
    rewards: {
      eggs?: {
        ranges: { min: number; max: number; chance: number }[];
      };
      chicken?: { types: string[]; chance: number };
      usdt?: { ranges: { amount: number; chance: number }[] };
      resources?: {
        wheat?: { ranges: { min: number; max: number; chance: number }[] };
        water?: { ranges: { min: number; max: number; chance: number }[] };
      };
    };
    rarityDistribution: { [key: string]: number };
  }
} = {
  basic: {
    price: 5,
    name: "Basic Mystery Box",
    description: "A basic mystery box with common rewards",
    rewards: {
      eggs: {
        ranges: [
          { min: 5, max: 10, chance: 0.50 }, // 50% chance
          { min: 11, max: 15, chance: 0.40 }, // 40% chance
          { min: 16, max: 20, chance: 0.10 }, // 10% chance
        ]
      }
    },
    rarityDistribution: {
      common: 0.9,
      uncommon: 0.1
    }
  },
  standard: {
    price: 10,
    name: "Standard Mystery Box",
    description: "A standard mystery box with balanced rewards",
    rewards: {
      eggs: {
        ranges: [
          { min: 10, max: 20, chance: 0.45 }, // 45% chance
          { min: 21, max: 30, chance: 0.35 }, // 35% chance
          { min: 31, max: 40, chance: 0.20 }, // 20% chance
        ]
      },
      chicken: {
        types: ["baby"],
        chance: 0.05 // 5% chance for baby chicken
      }
    },
    rarityDistribution: {
      common: 0.7,
      uncommon: 0.2,
      rare: 0.1
    }
  },
  advanced: {
    price: 20,
    name: "Advanced Mystery Box",
    description: "An advanced mystery box with better rewards",
    rewards: {
      eggs: {
        ranges: [
          { min: 20, max: 40, chance: 0.40 }, // 40% chance
          { min: 41, max: 60, chance: 0.35 }, // 35% chance
          { min: 61, max: 80, chance: 0.20 }, // 20% chance
        ]
      },
      chicken: {
        types: ["baby", "regular"],
        chance: 0.08 // 8% chance for chicken
      },
      usdt: {
        ranges: [
          { amount: 2, chance: 0.02 } // 2% chance for USDT
        ]
      },
      resources: {
        wheat: { 
          ranges: [{ min: 1, max: 5, chance: 0.5 }]
        },
        water: { 
          ranges: [{ min: 1, max: 5, chance: 0.5 }]
        }
      }
    },
    rarityDistribution: {
      common: 0.5,
      uncommon: 0.3,
      rare: 0.2
    }
  },
  legendary: {
    price: 50,
    name: "Legendary Mystery Box",
    description: "A legendary mystery box with the best possible rewards",
    rewards: {
      eggs: {
        ranges: [
          { min: 50, max: 100, chance: 0.35 }, // 35% chance
          { min: 101, max: 150, chance: 0.30 }, // 30% chance
          { min: 151, max: 200, chance: 0.22 }, // 22% chance
        ]
      },
      chicken: {
        types: ["regular", "golden"],
        chance: 0.10 // 10% chance for better chickens
      },
      usdt: {
        ranges: [
          { amount: 5, chance: 0.03 } // 3% chance for USDT
        ]
      },
      resources: {
        wheat: { 
          ranges: [{ min: 5, max: 10, chance: 0.5 }]
        },
        water: { 
          ranges: [{ min: 5, max: 10, chance: 0.5 }]
        }
      }
    },
    rarityDistribution: {
      common: 0.2,
      uncommon: 0.3,
      rare: 0.4,
      epic: 0.1
    }
  }
};
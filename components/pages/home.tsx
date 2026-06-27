import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, Radius } from '@/constants/theme';
import Header from '../include/header';
import Tirage from '../include/tirage';
import { getStoredUser, type VendeurUser } from '@/lib/auth';
import api from '@/lib/api';

interface VendeurStats {
    totalVentes: number;
    ficheCount: number;
    commissionRate: number;
    boulesTendance: { numero: number; count: number }[];
    dernieresVentes: { ref: string; lignes: number; total: number; tirage: string; createdAt: string }[];
}

const BOULE_COLORS = [Colors.gold, Colors.red, Colors.green, Colors.navyMedium];

function getGreeting(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const h = new Date(utc + (-4 * 60 * 60000)).getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
}

export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [user, setUser] = useState<VendeurUser | null>(null);
    const [stats, setStats] = useState<VendeurStats | null>(null);

    useFocusEffect(useCallback(() => {
        getStoredUser().then(setUser);
        api.get<VendeurStats>('/tickets/me/stats').then(({ data }) => setStats(data)).catch(() => {});
    }, []));

    const totalVentes = stats?.totalVentes || 0;
    const commissionRate = stats?.commissionRate || 0;
    const commissionAmount = Math.round(totalVentes * commissionRate / 100);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <Header />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scroll}
            >
                {/* Greeting */}
                <View style={styles.greeting}>
                    <Text style={styles.greetingSub}>{getGreeting()},</Text>
                    <Text style={styles.greetingName}>{user ? `${user.firstname} ${user.lastname}` : '...'}</Text>
                </View>

                {/* Stats cards */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { backgroundColor: Colors.gold }]}>
                        <Text style={styles.statLabel}>Ventes aujourd'hui</Text>
                        <Text style={styles.statValue}>{totalVentes.toLocaleString()} <Text style={styles.statCurrency}>HTG</Text></Text>
                        <Text style={styles.statSub}>{stats?.ficheCount || 0} fiche{(stats?.ficheCount || 0) > 1 ? 's' : ''}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: Colors.navyMedium }]}>
                        <Text style={styles.statLabel}>Ma commission</Text>
                        <Text style={[styles.statValue, { color: Colors.goldLight }]}>{commissionAmount.toLocaleString()} <Text style={styles.statCurrency}>HTG</Text></Text>
                        <Text style={styles.statSub}>{commissionRate}% des ventes</Text>
                    </View>
                </View>

                {/* Tirages */}
                <Tirage />

                {/* CTA Vendre */}
                <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/vendre')}>
                    <View style={styles.ctaLeft}>
                        <View style={styles.ctaIcon}>
                            <Text style={styles.ctaIconText}>🎫</Text>
                        </View>
                        <View>
                            <Text style={styles.ctaTitle}>Vendre un ticket</Text>
                        </View>
                    </View>
                    <Text style={styles.ctaArrow}>›</Text>
                </TouchableOpacity>

                {/* Boules tendance */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionIcon}>📈</Text>
                            <Text style={styles.sectionTitle}>Boules tendance</Text>
                        </View>
                        <View style={styles.liveBadge}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>LIVE</Text>
                        </View>
                    </View>

                    {(stats?.boulesTendance?.length || 0) > 0 ? (
                        <View style={styles.boulesRow}>
                            {stats!.boulesTendance.map((b, i) => (
                                <View key={b.numero} style={styles.bouleItem}>
                                    <View style={[styles.bouleCircle, { backgroundColor: BOULE_COLORS[i] || Colors.navyMedium }]}>
                                        <Text style={styles.bouleNum}>
                                            {String(b.numero).padStart(2, '0')}
                                        </Text>
                                    </View>
                                    <Text style={styles.bouleMises}>{b.count}x</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={{ color: Colors.gray, textAlign: 'center', fontSize: 13, paddingVertical: Spacing.lg }}>
                            Aucune vente aujourd'hui
                        </Text>
                    )}
                </View>

                {/* Dernières ventes */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Dernières ventes</Text>
                        <TouchableOpacity onPress={() => router.push('/rapports')}>
                            <Text style={styles.voirTout}>Voir tout →</Text>
                        </TouchableOpacity>
                    </View>

                    {(stats?.dernieresVentes?.length || 0) > 0 ? (
                        stats!.dernieresVentes.map((v, i) => (
                            <View key={v.ref} style={[styles.venteRow, i > 0 && styles.venteRowBorder]}>
                                <View style={styles.venteInfo}>
                                    <Text style={styles.venteType}>
                                        Fiche · {v.lignes} ligne{v.lignes > 1 ? 's' : ''}
                                    </Text>
                                    <Text style={styles.venteTirage}>{v.tirage} · {new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                                <View style={styles.venteRight}>
                                    <Text style={styles.venteMontant}>{Number(v.total).toLocaleString()} <Text style={styles.venteCurrency}>HTG</Text></Text>
                                    <Text style={styles.venteRef}>{v.ref}</Text>
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={{ color: Colors.gray, textAlign: 'center', fontSize: 13, paddingVertical: Spacing.lg }}>
                            Aucune vente aujourd'hui
                        </Text>
                    )}
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.navy,
    },
    scroll: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing['3xl'],
    },

    // Greeting
    greeting: {
        paddingVertical: Spacing.md,
    },
    greetingSub: {
        fontSize: 14,
        color: Colors.gray,
    },
    greetingName: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.offWhite,
        marginTop: 2,
    },

    // Stats
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    statCard: {
        flex: 1,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        overflow: 'hidden',
    },
    statLabel: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '800',
        color: Colors.white,
        fontVariant: ['tabular-nums'],
    },
    statCurrency: {
        fontSize: 8,
        fontWeight: '700',
    },
    statSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 4,
    },

    // CTA
    ctaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.white,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    ctaLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    ctaIcon: {
        width: 44,
        height: 44,
        borderRadius: Radius.md,
        backgroundColor: Colors.gold + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctaIconText: {
        fontSize: 22,
    },
    ctaTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.navy,
    },
    ctaSub: {
        fontSize: 12,
        color: Colors.grayDark,
        marginTop: 2,
    },
    ctaArrow: {
        fontSize: 28,
        color: Colors.navy,
        fontWeight: '300',
    },

    // Sections
    section: {
        backgroundColor: Colors.navyLight,
        borderRadius: Radius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    sectionIcon: {
        fontSize: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.green,
    },
    liveText: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.green,
    },

    // Boules
    boulesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: Spacing.lg,
    },
    bouleItem: {
        alignItems: 'center',
        gap: 6,
    },
    bouleCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bouleNum: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.white,
    },
    bouleMises: {
        fontSize: 12,
        color: Colors.gray,
    },
    // Ventes
    voirTout: {
        fontSize: 13,
        color: Colors.gold,
        fontWeight: '600',
    },
    venteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
    },
    venteRowBorder: {
        borderTopWidth: 1,
        borderTopColor: Colors.navyMedium,
    },
    venteInfo: {
        flex: 1,
    },
    venteType: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.offWhite,
    },
    venteTirage: {
        fontSize: 12,
        color: Colors.gray,
        marginTop: 2,
    },
    venteRight: {
        alignItems: 'flex-end',
    },
    venteMontant: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    venteCurrency: {
        fontSize: 9,
        fontWeight: '700',
    },
    venteRef: {
        fontSize: 11,
        color: Colors.gray,
        marginTop: 2,
    },
});

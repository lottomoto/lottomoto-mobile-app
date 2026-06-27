import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Radius } from '@/constants/theme';
import { getStoredUser, type VendeurUser } from '@/lib/auth';

export default function Header() {
    const [user, setUser] = useState<VendeurUser | null>(null);

    useEffect(() => {
        getStoredUser().then(setUser);
    }, []);

    const initials = user ? `${user.firstname[0]}${user.lastname[0]}`.toUpperCase() : '??';

    return (
        <View style={styles.header}>
            <View>
                <Text style={styles.brandName}>La Différence</Text>
                <Text style={styles.brandSub}>LOTTO / MOTO</Text>
            </View>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.navyMedium,
        paddingHorizontal: Spacing.xl,
        backgroundColor: Colors.navy,
        zIndex: 10,
    },
    brandName: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.offWhite,
    },
    brandSub: {
        fontSize: 10,
        letterSpacing: 2,
        color: Colors.gray,
        marginTop: 2,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.navyMedium,
        borderWidth: 2,
        borderColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: Colors.gold,
        fontWeight: '700',
        fontSize: 14,
    },
});
